// The time-of-use calculator: rebuilds a Day / Peak / Off-peak bill the way CEB/EDL and LECO
// work it out, then shows what solar and a battery (BESS) take off it and what the investment returns.
//
// The units are typed as the bill shows them. Bill rules (checked against real EDL and LECO bills):
//   solar export is set off against Day units only:  Day units billed = Day import − Export
//   max demand is the month's kVA reading (not a difference) × the demand rate
//   charges = each line rounded to the cent, plus the fixed charge
//   SSC Levy = charges × 2.5 ÷ 97.5, so the total is charges ÷ 0.975
//
// Battery rules:
//   one charge and one discharge a day; units delivered = units put in × round-trip efficiency
//   every unit put in has a cost, so no unit of solar is counted twice:
//     solar surplus (beyond Day use) loses its export payment,
//     solar that was replacing Day units puts those Day units back on the bill,
//     grid charging happens overnight at the Off-peak rate (and only serves the next peak)
//   each unit goes where it saves most (Peak before Off-peak) from the cheapest source,
//   and only when it saves more than it costs
//   max-demand savings are counted only when load data confirms the kVA reduction

import { toNumber, splitPayback, cleanEnergy } from './calc.js';
import { touSettings, batteryDefaults, periodHours, financeDefaults, findTariff } from '../config/tariffs.js';
import { assumptions, touExample } from '../config/company.js';
import { formatTyped } from './format.js';

// Unit fields on the form: the three time-of-use periods plus export from solar already installed.
export const UNIT_KEYS = ['day', 'peak', 'offPeak', 'export'];
export const BILL_LINES = ['day', 'peak', 'offPeak', 'demand', 'fixed'];
export const RATE_KEYS = ['day', 'peak', 'offPeak', 'demand', 'fixed'];
export const BATTERY_MODES = ['smart', 'peak', 'offPeak', 'demand'];
export const CHARGE_SOURCES = ['both', 'solar', 'grid'];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isBlank(value) {
  return String(value ?? '').replace(/[^0-9.]/g, '') === '';
}

// "88" → 0.88; a blank field uses the default.
const share = (value, fallback) => (isBlank(value) ? fallback : toNumber(value) / 100);
const numberOr = (value, fallback) => (isBlank(value) ? fallback : toNumber(value));

export function rateValues(input) {
  return Object.fromEntries(RATE_KEYS.map((key) => [key, toNumber(input.rates?.[key])]));
}

// One month's bill, line by line.
export function monthlyBill({ dayUnits, peakUnits, offPeakUnits, maxDemand, rates, sscl }) {
  const line = (quantity, rate) => ({ quantity, rate, amount: round2(quantity * rate) });
  const lines = {
    day: line(dayUnits, rates.day),
    peak: line(peakUnits, rates.peak),
    offPeak: line(offPeakUnits, rates.offPeak),
    demand: line(maxDemand, rates.demand),
    fixed: { quantity: null, rate: null, amount: round2(rates.fixed) },
  };
  const charges = round2(BILL_LINES.reduce((sum, key) => sum + lines[key].amount, 0));
  const rate = touSettings.ssclRate;
  const levy = sscl ? round2((charges * rate) / (1 - rate)) : 0;
  return { lines, charges, levy, total: round2(charges + levy) };
}

// What the monthly figure is called: a saving, an income, or a mix of both.
export function benefitNoun(r) {
  if (r.netPlus && !r.battery.on) return 'income';
  return r.soldUnits > 0 || r.netPlus ? 'benefit' : 'saving';
}

export function generationFromSize(kwp) {
  return kwp * touSettings.unitsPerKwpPerMonth;
}

// ------------------------------------------------------------ battery

export function batterySettings(input) {
  const b = input.battery ?? {};
  return {
    on: Boolean(b.on),
    capacity: toNumber(b.capacity),
    power: toNumber(b.power),
    mode: BATTERY_MODES.includes(b.mode) ? b.mode : 'smart',
    charging: CHARGE_SOURCES.includes(b.charging) ? b.charging : 'both',
    usable: Math.min(1, share(b.usable, batteryDefaults.usable)),
    efficiency: Math.min(1, Math.max(0.01, share(b.efficiency, batteryDefaults.efficiency))),
    dailyLimit: toNumber(b.dailyLimit),
    days: numberOr(b.days, batteryDefaults.daysPerMonth) || batteryDefaults.daysPerMonth,
    mdReduction: toNumber(b.mdReduction),
    mdVerified: Boolean(b.mdVerified),
  };
}

// A battery size people would quote: kWh in steps of 10 (5 when small), kW in steps of 5.
const roundUp = (n, step) => Math.ceil(n / step - 1e-9) * step;

export function recommendBattery({ mode, peakUnits, offPeakUnits, days, usable }) {
  const offPeak = mode === 'offPeak';
  const daily = (offPeak ? offPeakUnits : peakUnits) / days;
  if (mode === 'demand' || daily <= 0) return null;
  const kwh = daily / usable;
  const kw = daily / (offPeak ? periodHours.offPeak : periodHours.peak);
  return { daily, kwh: roundUp(kwh, kwh >= 100 ? 10 : 5), kw: roundUp(kw, 5) };
}

// Battery price estimate from its size, rounded to Rs. 100,000.
export function estimateBatteryCost(kwh) {
  return Math.round((kwh * batteryDefaults.pricePerKwh) / 100000) * 100000;
}

// How the battery runs each day. All figures in kWh per day.
//   targets: where a delivered unit saves money (Peak, Off-peak)
//   sources: where a stored unit comes from, and what it costs
export function batteryPlan({ settings: b, peakUnits, offPeakUnits, surplusUnits, daySolarUnits, rates, exportRate }) {
  const perDay = (units) => units / b.days;
  const eff = b.efficiency;
  const usableKwh = b.capacity * b.usable;

  const targets = [];
  if (b.mode === 'smart' || b.mode === 'peak') {
    targets.push({ key: 'peak', value: rates.peak, room: Math.min(perDay(peakUnits), b.power * periodHours.peak) });
  }
  if (b.mode === 'smart' || b.mode === 'offPeak') {
    targets.push({ key: 'offPeak', value: rates.offPeak, room: Math.min(perDay(offPeakUnits), b.power * periodHours.offPeak) });
  }

  const sources = [];
  if (b.charging !== 'grid') {
    sources.push({ key: 'surplus', cost: exportRate, left: perDay(surplusUnits), solar: true });
    sources.push({ key: 'daySolar', cost: rates.day, left: perDay(daySolarUnits), solar: true });
  }
  if (b.charging !== 'solar') {
    // Charged overnight, so it can only serve the next evening's peak.
    sources.push({ key: 'grid', cost: rates.offPeak, left: b.power * periodHours.offPeak, serves: 'peak' });
  }

  const pairs = [];
  for (const t of targets) {
    for (const s of sources) {
      if (!s.serves || s.serves === t.key) pairs.push({ t, s, margin: t.value - s.cost / eff });
    }
  }
  pairs.sort((x, y) => y.margin - x.margin);

  const day = { peak: 0, offPeak: 0, surplus: 0, daySolar: 0, grid: 0 };
  let room = b.dailyLimit > 0 ? Math.min(usableKwh, b.dailyLimit) : usableKwh;
  let solarIn = b.power * periodHours.solar;
  const notWorthIt = { peak: false, offPeak: false };
  for (const { t, s, margin } of pairs) {
    if (margin <= 0) {
      if (t.room > 1e-6 && s.left > 1e-6) notWorthIt[t.key] = true;
      continue;
    }
    const deliver = Math.min(t.room, room, s.left * eff, s.solar ? solarIn * eff : Infinity);
    if (deliver <= 1e-9) continue;
    t.room -= deliver;
    room -= deliver;
    s.left -= deliver / eff;
    if (s.solar) solarIn -= deliver / eff;
    day[t.key] += deliver;
    day[s.key] += deliver / eff;
  }
  // A target that was fully served wasn't held back by cost.
  for (const t of targets) if (t.room <= 1e-6) notWorthIt[t.key] = false;

  // What holds the peak discharge back, for the advice on the page.
  let limit = null;
  if (targets.some((t) => t.key === 'peak')) {
    const peakUse = perDay(peakUnits);
    if (day.peak >= peakUse - 0.01) limit = 'usage';
    else if (room <= 0.01) limit = b.dailyLimit > 0 && b.dailyLimit < usableKwh ? 'dailyLimit' : 'capacity';
    else if (b.power * periodHours.peak <= day.peak + 0.01) limit = 'power';
    else if (notWorthIt.peak) limit = 'cost';
    else limit = 'charging';
  }

  const month = (kwh) => kwh * b.days;
  return {
    usableKwh,
    perDay: day,
    peak: month(day.peak),
    offPeak: month(day.offPeak),
    charge: { surplus: month(day.surplus), daySolar: month(day.daySolar), grid: month(day.grid) },
    delivered: month(day.peak + day.offPeak),
    chargedIn: month(day.surplus + day.daySolar + day.grid),
    limit,
    notWorthIt,
  };
}

// ------------------------------------------------------------ returns

export function financeSettings(input) {
  const f = input.finance ?? {};
  return {
    maintenance: share(f.maintenance, financeDefaults.maintenance),
    batteryLife: Math.max(0, Math.round(numberOr(f.batteryLife, financeDefaults.batteryLife))),
    replacement: share(f.replacement, financeDefaults.replacement),
    batteryLoss: Math.min(1, share(f.batteryLoss, financeDefaults.batteryLoss)),
    solarLoss: Math.min(1, share(f.solarLoss, financeDefaults.solarLoss)),
    discountRate: share(f.discount, financeDefaults.discountRate),
  };
}

// Year-by-year cash flow: savings shrink as panels and battery age, maintenance is paid every year,
// and the battery is replaced at the end of its life.
//   annual net saving = savings − maintenance (− battery replacement in that year)
//   simple payback     = investment ÷ first-year net saving
//   payback            = when the running total turns positive
export function investmentReturns({ solarMonthly, batteryMonthly, investment, batteryCost, hasBattery, finance }) {
  const years = assumptions.projectionYears;
  const maintenance = finance.maintenance * investment;
  const life = hasBattery ? finance.batteryLife : 0;

  const yearOf = (y) => {
    const solarFactor = (1 - finance.solarLoss) ** (y - 1);
    const age = life > 0 ? (y - 1) % life : y - 1;
    const batteryFactor = hasBattery ? (1 - finance.batteryLoss) ** age : 0;
    const saving = 12 * (solarMonthly * solarFactor + batteryMonthly * batteryFactor);
    const replacement = life > 0 && y > 1 && (y - 1) % life === 0 ? finance.replacement * batteryCost : 0;
    return { year: y, saving, maintenance, replacement, net: saving - maintenance - replacement };
  };

  const hasCost = investment > 0;
  const yearly = [];
  const cumulative = [-investment];
  let position = -investment;
  let npv = -investment;
  let paybackYears = null;
  for (let y = 1; y <= Math.max(years, 60); y++) {
    const row = yearOf(y);
    if (hasCost && paybackYears == null && position < 0 && row.net > 0 && position + row.net >= 0) {
      paybackYears = y - 1 + -position / row.net;
    }
    position += row.net;
    if (y <= years) {
      npv += row.net / (1 + finance.discountRate) ** y;
      yearly.push({ ...row, position });
      cumulative.push(position);
    } else if (paybackYears != null || !hasCost) {
      break;
    }
  }

  const firstYearNet = yearly[0].net;
  const paybackMonths = paybackYears == null ? null : paybackYears * 12;
  return {
    investment,
    hasCost,
    totalMonthlyIncome: solarMonthly + batteryMonthly,
    maintenance,
    firstYearNet,
    yearIncome: firstYearNet,
    roi: hasCost ? (firstYearNet / investment) * 100 : 0,
    simplePaybackYears: hasCost && firstYearNet > 0 ? investment / firstYearNet : null,
    paybackMonths,
    payback: splitPayback(paybackMonths),
    paybackYears,
    years,
    yearly,
    cumulative,
    benefitToDate: cumulative.map((v) => v + investment),
    netGain: cumulative[years],
    npv,
    discountRate: finance.discountRate,
    milestones: [5, 10, 15, 20].filter((y) => y <= years).map((y) => ({ year: y, position: cumulative[y] })),
    replacementYears: yearly.filter((row) => row.replacement > 0).map((row) => row.year),
  };
}

// ------------------------------------------------------------ the whole calculation

export function calculateTou(input) {
  const unitsOf = (key) => toNumber(input.units?.[key]);
  const dayImport = unitsOf('day');
  const exported = unitsOf('export');
  const peakUnits = unitsOf('peak');
  const offPeakUnits = unitsOf('offPeak');

  // Solar already on the roof: its export is set off against Day units only.
  const dayUnits = Math.max(0, dayImport - exported);
  const existingSurplus = Math.max(0, exported - dayImport);
  const nightUnits = peakUnits + offPeakUnits;
  const totalUnits = dayUnits + nightUnits; // "Net units consumed" on LECO bills

  const maxDemand = toNumber(input.maxDemand);
  const rates = rateValues(input);
  const sscl = input.sscl !== false;
  const billOf = ({ day = dayUnits, peak = peakUnits, offPeak = offPeakUnits, demand = maxDemand } = {}) =>
    monthlyBill({ dayUnits: day, peakUnits: peak, offPeakUnits: offPeak, maxDemand: demand, rates, sscl });

  const today = billOf();

  // ---- solar. Panels only produce in daylight, so on site they can only replace Day units.
  const generation = toNumber(input.generation);
  const exportRate = toNumber(input.exportRate);
  const netPlus = input.scheme === 'netplus';

  const solarToDay = netPlus ? 0 : Math.min(generation, dayUnits);
  const soldUnits = netPlus ? generation : generation - solarToDay;
  const withSolar = netPlus ? today : billOf({ day: dayUnits - solarToDay });
  const billSaving = round2(today.total - withSolar.total);
  const solarIncome = round2(soldUnits * exportRate);
  const solarSaving = round2(billSaving + solarIncome);

  // ---- battery
  const bs = batterySettings(input);
  const batteryOn = bs.on && bs.capacity > 0 && bs.power > 0;
  // Solar the battery could take: surplus beyond Day use, and solar now replacing Day units
  // (from the new system, or export from solar already installed). Net Plus solar is all sold.
  const surplusPool = (netPlus ? 0 : soldUnits) + existingSurplus;
  const daySolarPool = (netPlus ? 0 : solarToDay) + Math.min(exported, dayImport);
  const plan = batteryOn
    ? batteryPlan({ settings: bs, peakUnits, offPeakUnits, surplusUnits: surplusPool, daySolarUnits: daySolarPool, rates, exportRate })
    : null;

  // Max demand: the battery can only cut what its inverter supplies, and it only counts once
  // half-hourly load data shows the reduction is achievable.
  const aimsAtDemand = bs.mode === 'demand' || bs.mode === 'smart';
  const demandPossible = batteryOn && aimsAtDemand ? Math.max(0, Math.min(bs.mdReduction, bs.power, maxDemand)) : 0;
  const demandCounted = bs.mdVerified ? demandPossible : 0;

  const withBattery = batteryOn
    ? billOf({
        day: dayUnits - solarToDay + plan.charge.daySolar,
        peak: peakUnits - plan.peak,
        offPeak: offPeakUnits - plan.offPeak + plan.charge.grid,
        demand: maxDemand - demandCounted,
      })
    : withSolar;

  const levyFactor = sscl ? 1 / (1 - touSettings.ssclRate) : 1;
  const lostExport = batteryOn ? plan.charge.surplus * exportRate : 0;
  const batterySaving = batteryOn ? round2(withSolar.total - withBattery.total - lostExport) : 0;
  const batteryParts = batteryOn
    ? {
        peak: plan.peak * rates.peak * levyFactor,
        offPeak: plan.offPeak * rates.offPeak * levyFactor,
        demand: demandCounted * rates.demand * levyFactor,
        charging: (plan.charge.daySolar * rates.day + plan.charge.grid * rates.offPeak) * levyFactor + lostExport,
      }
    : { peak: 0, offPeak: 0, demand: 0, charging: 0 };

  // Overnight grid charging adds load; warn when it could set a new maximum demand.
  const nightChargeKw = batteryOn ? plan.perDay.grid / periodHours.offPeak : 0;
  const nightLoadKw = offPeakUnits / bs.days / periodHours.offPeak;
  const nightKva = (nightLoadKw + nightChargeKw) / batteryDefaults.powerFactor;
  const nightDemandRisk = nightChargeKw > 0 && maxDemand > 0 && nightKva > 0.8 * (maxDemand - demandCounted);

  // ---- investment
  const costs = {
    solar: toNumber(input.costs?.solar),
    battery: batteryOn ? toNumber(input.costs?.battery) : 0,
    other: toNumber(input.costs?.other),
  };
  const investment = costs.solar + costs.battery + costs.other;
  const finance = financeSettings(input);
  const returns = investmentReturns({
    solarMonthly: solarSaving,
    batteryMonthly: batterySaving,
    investment,
    batteryCost: costs.battery,
    hasBattery: batteryOn,
    finance,
  });

  // Optional check against the total printed on the bill.
  const billTotal = isBlank(input.billTotal) ? null : toNumber(input.billTotal);
  const billDifference = billTotal == null ? null : round2(today.total - billTotal);

  return {
    dayImport,
    exported,
    dayUnits,
    existingSurplus,
    peakUnits,
    offPeakUnits,
    nightUnits,
    totalUnits,
    maxDemand,
    rates,
    sscl,
    levyFactor,
    today,
    withSolar,
    withBattery,
    netPlus,
    exportRate,
    generation,
    solarToDay,
    soldUnits,
    dayBalance: dayUnits - solarToDay,
    billSaving,
    solarIncome,
    solarSaving,
    batterySaving,
    billTotal,
    billDifference,
    suggestedKwp: dayUnits / touSettings.unitsPerKwpPerMonth,
    battery: {
      ...bs,
      on: batteryOn,
      plan,
      parts: batteryParts,
      recommended: recommendBattery({ mode: bs.mode, peakUnits, offPeakUnits, days: bs.days, usable: bs.usable }),
      demandPossible,
      demandCounted,
      demandPossibleSaving: demandPossible * rates.demand * levyFactor,
      nightChargeKw,
      nightKva,
      nightDemandRisk,
    },
    costs,
    finance,
    ...returns,
    ...cleanEnergy(generation),
  };
}

// ------------------------------------------------------------ page state

// Rates of a listed tariff, formatted the way the rate fields show them (null when not built in).
export function tariffRateFields(tariffId) {
  const tariff = findTariff(tariffId);
  if (!tariff?.rates) return null;
  const { day, peak, offPeak, demand, fixed } = tariff.rates;
  return {
    day: formatTyped(day, 2),
    peak: formatTyped(peak, 2),
    offPeak: formatTyped(offPeak, 2),
    demand: formatTyped(demand, 'auto'),
    fixed: formatTyped(fixed, 'auto'),
  };
}

export const blankRates = () => Object.fromEntries(RATE_KEYS.map((key) => [key, '']));

// True when the rate fields still hold the listed tariff's rates.
export function ratesMatchTariff(input) {
  const tariff = findTariff(input.tariff);
  if (!tariff?.rates) return true;
  return RATE_KEYS.every((key) => Math.abs(toNumber(input.rates?.[key]) - tariff.rates[key]) < 1e-9);
}

const emptyUnits = () => Object.fromEntries(UNIT_KEYS.map((key) => [key, '']));
const percentField = (shareValue) => formatTyped(shareValue * 100, 'auto');

// The figures the time-of-use calculator opens with (see touExample in src/config/company.js).
// The battery starts at the size suggested for the example's peak use.
export function touDefaultInputs() {
  const ex = touExample;
  const rec = recommendBattery({
    mode: 'smart',
    peakUnits: toNumber(ex.units.peak),
    offPeakUnits: toNumber(ex.units.offPeak),
    days: batteryDefaults.daysPerMonth,
    usable: batteryDefaults.usable,
  });
  return {
    tariff: ex.tariff,
    units: { ...emptyUnits(), ...ex.units },
    maxDemand: ex.maxDemand,
    rates: tariffRateFields(ex.tariff),
    sscl: true,
    billTotal: '',
    systemSize: ex.systemSize,
    generation: formatTyped(generationFromSize(toNumber(ex.systemSize)), 0),
    scheme: 'onsite',
    exportRate: formatTyped(touSettings.exportRate, 2),
    battery: {
      on: ex.battery,
      capacity: formatTyped(rec.kwh, 'auto'),
      power: formatTyped(rec.kw, 'auto'),
      mode: 'smart',
      charging: 'both',
      usable: percentField(batteryDefaults.usable),
      efficiency: percentField(batteryDefaults.efficiency),
      dailyLimit: '',
      days: formatTyped(batteryDefaults.daysPerMonth, 'auto'),
      mdReduction: '',
      mdVerified: false,
    },
    costs: {
      solar: ex.solarCost,
      battery: formatTyped(estimateBatteryCost(rec.kwh), 0),
      other: '',
    },
    finance: {
      maintenance: percentField(financeDefaults.maintenance),
      batteryLife: formatTyped(financeDefaults.batteryLife, 'auto'),
      replacement: percentField(financeDefaults.replacement),
      batteryLoss: percentField(financeDefaults.batteryLoss),
      solarLoss: percentField(financeDefaults.solarLoss),
      discount: percentField(financeDefaults.discountRate),
    },
    engineering: false,
    existingSolar: '',
    customerName: '',
    location: '',
  };
}

// A blank bill for the next customer: keeps the tariff, rates, solar, battery and money assumptions.
export function clearedBillInputs(current) {
  return {
    ...current,
    units: emptyUnits(),
    maxDemand: '',
    billTotal: '',
    battery: { ...current.battery, mdReduction: '', mdVerified: false },
    existingSolar: '',
    customerName: '',
    location: '',
  };
}
