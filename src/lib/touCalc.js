// The time-of-use calculator: rebuilds a Day / Peak / Off-peak bill the way CEB/EDL and LECO
// work it out, then shows what a solar system takes off it.
//
// The units are typed as the bill shows them. Bill rules (checked against real EDL and LECO bills):
//   solar export is set off against Day units only:  Day units billed = Day import − Export
//   max demand is the month's kVA reading (not a difference) × the demand rate
//   charges = each line rounded to the cent, plus the fixed charge
//   SSC Levy = charges × 2.5 ÷ 97.5, so the total is charges ÷ 0.975

import { toNumber, projection } from './calc.js';
import { touSettings, findTariff } from '../config/tariffs.js';
import { touExample } from '../config/company.js';
import { formatTyped } from './format.js';

// Unit fields on the form: the three time-of-use periods plus export from solar already installed.
export const UNIT_KEYS = ['day', 'peak', 'offPeak', 'export'];
export const BILL_LINES = ['day', 'peak', 'offPeak', 'demand', 'fixed'];
export const RATE_KEYS = ['day', 'peak', 'offPeak', 'demand', 'fixed'];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isBlank(value) {
  return String(value ?? '').replace(/[^0-9.]/g, '') === '';
}

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
  if (r.netPlus) return 'income';
  return r.soldUnits > 0 ? 'benefit' : 'saving';
}

export function generationFromSize(kwp) {
  return kwp * touSettings.unitsPerKwpPerMonth;
}

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
  const billFor = (day) => monthlyBill({ dayUnits: day, peakUnits, offPeakUnits, maxDemand, rates, sscl });

  const today = billFor(dayUnits);

  // The proposed system. Panels only produce in daylight, so on site they can only
  // replace Day units; Peak, Off-peak, max demand and the fixed charge stay as they are.
  const generation = toNumber(input.generation);
  const exportRate = toNumber(input.exportRate);
  const investment = toNumber(input.investment);
  const netPlus = input.scheme === 'netplus';

  const solarToDay = netPlus ? 0 : Math.min(generation, dayUnits);
  const soldUnits = netPlus ? generation : generation - solarToDay;
  const withSolar = netPlus ? today : billFor(dayUnits - solarToDay);
  const billSaving = round2(today.total - withSolar.total);
  const solarIncome = round2(soldUnits * exportRate);
  const monthlyBenefit = round2(billSaving + solarIncome);

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
    today,
    withSolar,
    netPlus,
    exportRate,
    solarToDay,
    soldUnits,
    dayBalance: dayUnits - solarToDay,
    billSaving,
    solarIncome,
    billTotal,
    billDifference,
    suggestedKwp: dayUnits / touSettings.unitsPerKwpPerMonth,
    ...projection({ monthlyBenefit, investment, generation }),
  };
}

// ------------------------------------------------------------ page state

// Rates of a listed tariff, formatted the way the rate fields show them.
export function tariffRateFields(tariffId) {
  const tariff = findTariff(tariffId);
  if (!tariff) return null;
  const { day, peak, offPeak, demand, fixed } = tariff.rates;
  return {
    day: formatTyped(day, 2),
    peak: formatTyped(peak, 2),
    offPeak: formatTyped(offPeak, 2),
    demand: formatTyped(demand, 'auto'),
    fixed: formatTyped(fixed, 'auto'),
  };
}

// True when the rate fields still hold the listed tariff's rates.
export function ratesMatchTariff(input) {
  const tariff = findTariff(input.tariff);
  if (!tariff) return true;
  return RATE_KEYS.every((key) => Math.abs(toNumber(input.rates?.[key]) - tariff.rates[key]) < 1e-9);
}

const emptyUnits = () => Object.fromEntries(UNIT_KEYS.map((key) => [key, '']));

// The figures the time-of-use calculator opens with (see touExample in src/config/company.js).
export function touDefaultInputs() {
  const ex = touExample;
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
    investment: ex.investment,
    customerName: '',
    location: '',
  };
}

// A blank bill for the next customer: keeps the tariff, rates and solar assumptions.
export function clearedBillInputs(current) {
  return {
    ...current,
    units: emptyUnits(),
    maxDemand: '',
    billTotal: '',
    customerName: '',
    location: '',
  };
}
