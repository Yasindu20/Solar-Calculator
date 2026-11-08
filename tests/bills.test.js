// Checks the calculators against real bills. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculate } from '../src/lib/calc.js';
import { defaultInputs } from '../src/config/company.js';
import {
  calculateTou,
  monthlyBill,
  investmentReturns,
  touDefaultInputs,
  clearedBillInputs,
  tariffRateFields,
  ratesMatchTariff,
} from '../src/lib/touCalc.js';

// The example business (8,000 Day / 6,000 Peak / 3,000 Off-peak, 100 kVA, GP-2, 50 kWp) with
// its battery switched off or changed.
const solarOnly = (extra = {}) => {
  const ex = touDefaultInputs();
  return { ...ex, battery: { ...ex.battery, on: false }, ...extra };
};
const withBattery = (battery = {}, extra = {}) => {
  const ex = touDefaultInputs();
  return { ...ex, ...extra, battery: { ...ex.battery, on: true, ...battery } };
};

const close = (actual, expected, cents = 0.005) =>
  assert.ok(Math.abs(actual - expected) <= cents, `expected ${expected}, got ${actual}`);

const rates = (day, peak, offPeak, demand, fixed) => ({ day, peak, offPeak, demand, fixed });

// Units typed exactly as the bill prints them.
const billInput = (units, extra) => ({
  units: { export: '', ...units },
  sscl: true,
  scheme: 'onsite',
  generation: '0',
  ...extra,
});

test('EDL (formerly CEB) industrial I-2 bill, October 2026 — reproduced to the cent', () => {
  const r = calculateTou(
    billInput(
      { day: '106,103', peak: '24,688', offPeak: '19,462' },
      { maxDemand: '599', rates: tariffRateFields('I-2'), billTotal: '4,404,371.28' },
    ),
  );
  assert.equal(r.dayUnits, 106103);
  assert.equal(r.peakUnits, 24688);
  assert.equal(r.offPeakUnits, 19462);
  assert.equal(r.today.lines.day.amount, 2015957);
  assert.equal(r.today.lines.peak.amount, 962832);
  assert.equal(r.today.lines.offPeak.amount, 321123);
  assert.equal(r.today.lines.demand.amount, 988350);
  assert.equal(r.today.lines.fixed.amount, 6000);
  assert.equal(r.today.charges, 4294262);
  close(r.today.levy, 110109.28);
  close(r.today.total, 4404371.28);
  assert.equal(r.billDifference, 0);
});

test('LECO GP-2 bill with solar export, February 2026 — export set off against Day units', () => {
  const r = calculateTou(
    billInput(
      // "Total Units for the Month" row
      { day: '6,017', peak: '5,593', offPeak: '2,712', export: '5,006' },
      // the rates in force in February 2026
      { maxDemand: '78', rates: rates('41', '47', '31', '1,500', '5,000') },
    ),
  );
  assert.equal(r.dayImport, 6017);
  assert.equal(r.exported, 5006);
  assert.equal(r.dayUnits, 1011); // "Units Considered" on page 2
  assert.equal(r.totalUnits, 9316); // "Net Units Consumed"
  assert.equal(r.existingSurplus, 0); // "Generation Payment Units: 0"
  assert.equal(r.today.lines.day.amount, 41451);
  assert.equal(r.today.lines.peak.amount, 262871);
  assert.equal(r.today.lines.offPeak.amount, 84072);
  assert.equal(r.today.lines.demand.amount, 117000);
  assert.equal(r.today.charges, 510394);
  close(r.today.levy, 13087.03);
  close(r.today.total, 523481.03);
});

test('LECO GP-2 bill, May 2026 — both tariff periods match the bill lines', () => {
  // The tariff changed on 11 May, so LECO split the month 10 + 21 days of 31.
  const period = (d, p, o, md, r, fixed) =>
    monthlyBill({ dayUnits: d, peakUnits: p, offPeakUnits: o, maxDemand: md, rates: { ...r, fixed }, sscl: false });
  const before = period(936, 2144, 1112, 34, rates(43, 66, 34, 1500), (5000 * 10) / 31);
  const after = period(1967, 4503, 2335, 71, rates(51, 78, 40, 1800), (6000 * 21) / 31);
  assert.equal(before.lines.day.amount, 40248);
  assert.equal(before.lines.peak.amount, 141504);
  assert.equal(before.lines.offPeak.amount, 37808);
  assert.equal(before.lines.demand.amount, 51000);
  close(before.lines.fixed.amount, 1612.9);
  assert.equal(after.lines.day.amount, 100317);
  assert.equal(after.lines.peak.amount, 351234);
  assert.equal(after.lines.offPeak.amount, 93400);
  assert.equal(after.lines.demand.amount, 127800);
  close(after.lines.fixed.amount, 4064.52);
  close(before.charges + after.charges, 948988.4, 0.03); // bill rounds the split fixed charge 2 cents differently
});

test('the same May 2026 units at today’s GP-2 rates flag a difference from the split bill', () => {
  const r = calculateTou(
    billInput(
      { day: '7,751', peak: '6,647', offPeak: '3,447', export: '4,848' },
      { maxDemand: '105', rates: tariffRateFields('GP-2'), billTotal: '973,321.44' },
    ),
  );
  assert.equal(r.dayUnits, 2903);
  assert.equal(r.totalUnits, 12997);
  assert.equal(r.today.charges, 999399);
  assert.ok(r.billDifference > 1, 'a whole month at the new rates costs more than the split bill');
});

test('solar used on site replaces Day units only, and the levy falls with it', () => {
  const r = calculateTou(solarOnly({ finance: { maintenance: '0', solarLoss: '0' } }));
  assert.equal(r.generation, 6000);
  assert.equal(r.solarToDay, 6000);
  assert.equal(r.dayBalance, 2000);
  assert.equal(r.soldUnits, 0);
  assert.equal(r.today.charges, 8000 * 51 + 6000 * 78 + 3000 * 40 + 100 * 1800 + 6000);
  assert.equal(r.withSolar.lines.peak.amount, r.today.lines.peak.amount);
  assert.equal(r.withSolar.lines.demand.amount, r.today.lines.demand.amount);
  close(r.billSaving, (6000 * 51) / 0.975, 0.02);
  close(r.totalMonthlyIncome, r.billSaving);
  assert.equal(r.payback.years, 2);
});

test('solar bigger than daytime use: the surplus is paid at the export rate', () => {
  const r = calculateTou(solarOnly({ generation: '10,000', exportRate: '15.49' }));
  assert.equal(r.solarToDay, 8000);
  assert.equal(r.dayBalance, 0);
  assert.equal(r.soldUnits, 2000);
  close(r.solarIncome, 2000 * 15.49);
  assert.equal(r.withSolar.lines.day.amount, 0);
});

test('Net Plus: the bill stays the same and every unit is paid', () => {
  const r = calculateTou(solarOnly({ scheme: 'netplus', exportRate: '20' }));
  assert.equal(r.withSolar.total, r.today.total);
  assert.equal(r.billSaving, 0);
  assert.equal(r.soldUnits, 6000);
  assert.equal(r.totalMonthlyIncome, 120000);
});

test('SSC Levy can be left off', () => {
  const r = calculateTou({ ...touDefaultInputs(), sscl: false });
  assert.equal(r.today.levy, 0);
  assert.equal(r.today.total, r.today.charges);
});

test('rates edited away from the tariff are noticed; clearing keeps the tariff and solar figures', () => {
  const ex = touDefaultInputs();
  assert.ok(ratesMatchTariff(ex));
  assert.ok(!ratesMatchTariff({ ...ex, rates: { ...ex.rates, day: '52.00' } }));
  const cleared = clearedBillInputs(ex);
  assert.equal(cleared.units.day, '');
  assert.equal(cleared.maxDemand, '');
  assert.deepEqual(cleared.rates, ex.rates);
  assert.equal(cleared.systemSize, ex.systemSize);
});

// ------------------------------------------------------------ battery

const levy = 1 / 0.975;

test('smart battery on the example: charged overnight from the grid, discharged at peak, charging cost counted', () => {
  const r = calculateTou(withBattery());
  const b = r.battery;
  assert.equal(b.capacity, 230); // 200 kWh of peak use a day ÷ 90% usable, rounded up
  assert.equal(b.power, 50); // 200 kWh over the 4 peak hours
  close(b.plan.peak, 6000, 1e-6); // every peak unit of the month
  close(b.plan.charge.grid, 6000 / 0.88, 1e-6); // overnight charging is cheaper than diverting solar
  assert.equal(b.plan.charge.daySolar, 0);
  assert.equal(b.plan.limit, 'usage');
  close(r.withBattery.lines.peak.quantity, 0, 1e-6);
  close(r.withBattery.lines.offPeak.quantity, 3000 + 6000 / 0.88, 1e-6);
  close(r.batterySaving, (6000 * 78 - (6000 / 0.88) * 40) * levy, 0.02);
  close(b.parts.peak - b.parts.charging, r.batterySaving, 0.05);
  close(r.totalMonthlyIncome, r.solarSaving + r.batterySaving, 0.01);
});

test('solar is never counted twice: solar put into the battery stops replacing Day units', () => {
  const r = calculateTou(withBattery({ charging: 'solar' }));
  const charged = r.battery.plan.charge.daySolar;
  close(charged, 6000, 1e-6); // all 200 kWh a day of solar goes in…
  close(r.battery.plan.peak, 6000 * 0.88, 1e-6); // …and 88% of it comes out at peak
  // Day units go back on the bill by exactly what the battery took
  close(r.withBattery.lines.day.quantity, r.withSolar.lines.day.quantity + charged, 1e-6);
  close(r.withBattery.lines.day.quantity, 8000, 1e-6);
  close(r.batterySaving, (6000 * 0.88 * 78 - 6000 * 51) * levy, 0.02);
});

test('your example: 50 kWh a day at the I-2 peak rate is Rs. 58,500 a month before the levy and charging', () => {
  const r = calculateTou(
    withBattery(
      { capacity: '1,000', power: '200', dailyLimit: '50', mode: 'peak' },
      { tariff: 'I-2', rates: tariffRateFields('I-2'), units: { day: '106,103', peak: '24,688', offPeak: '19,462', export: '' }, maxDemand: '599', sscl: false },
    ),
  );
  close(r.battery.plan.peak, 1500, 1e-6);
  close(r.battery.parts.peak, 58500, 0.01);
  close(r.battery.parts.charging, (1500 / 0.88) * 16.5, 0.01); // overnight charging at the off-peak rate
  close(r.batterySaving, 58500 - (1500 / 0.88) * 16.5, 0.02);
});

test('off-peak use only runs when it pays: it depends on what the stored surplus would have earned', () => {
  // GP-2: an off-peak unit saves Rs. 40, a surplus unit only earns Rs. 15.49 → worth storing
  const gp2 = calculateTou(withBattery({ mode: 'offPeak' }, { generation: '20,000', exportRate: '15.49' }));
  assert.ok(gp2.battery.plan.offPeak > 0);
  assert.equal(gp2.battery.plan.charge.grid, 0);
  // I-2: an off-peak unit saves Rs. 16.50, less than 15.49 ÷ 0.88 → not worth it
  const i2 = { tariff: 'I-2', rates: tariffRateFields('I-2'), generation: '20,000' };
  const notWorth = calculateTou(withBattery({ mode: 'offPeak' }, { ...i2, exportRate: '15.49' }));
  assert.equal(notWorth.battery.plan.offPeak, 0); // 16.50 − 15.49 ÷ 0.88 < 0
  assert.equal(notWorth.battery.plan.notWorthIt.offPeak, true);
  assert.equal(notWorth.batterySaving, 0);
  const free = calculateTou(withBattery({ mode: 'offPeak' }, { ...i2, exportRate: '0' }));
  assert.ok(free.battery.plan.offPeak > 0);
  assert.ok(free.batterySaving > 0);
});

test('grid charging never serves off-peak use', () => {
  const r = calculateTou(withBattery({ mode: 'offPeak', charging: 'grid' }));
  assert.equal(r.battery.plan.offPeak, 0);
  assert.equal(r.battery.plan.charge.grid, 0);
});

test('max demand is counted only when load data confirms it, and never beyond the inverter power', () => {
  const unconfirmed = calculateTou(withBattery({ mdReduction: '20' }));
  assert.equal(unconfirmed.battery.demandPossible, 20);
  assert.equal(unconfirmed.battery.demandCounted, 0);
  assert.equal(unconfirmed.withBattery.lines.demand.quantity, 100);
  close(unconfirmed.battery.demandPossibleSaving, 20 * 1800 * levy, 0.01);

  const confirmed = calculateTou(withBattery({ mdReduction: '20', mdVerified: true }));
  assert.equal(confirmed.withBattery.lines.demand.quantity, 80);
  close(confirmed.batterySaving - unconfirmed.batterySaving, 20 * 1800 * levy, 0.05);

  const capped = calculateTou(withBattery({ mdReduction: '80', mdVerified: true }));
  assert.equal(capped.battery.demandCounted, 50); // the 50 kW inverter
  const peakOnly = calculateTou(withBattery({ mode: 'peak', mdReduction: '20', mdVerified: true }));
  assert.equal(peakOnly.battery.demandCounted, 0); // peak-hour mode doesn't aim at max demand
});

test('Net Plus solar is all sold, so it cannot charge the battery', () => {
  const r = calculateTou(withBattery({ charging: 'solar' }, { scheme: 'netplus' }));
  assert.equal(r.battery.plan.chargedIn, 0);
});

test('big overnight charging that could set a new maximum demand is flagged', () => {
  const r = calculateTou(withBattery({ capacity: '1,000', power: '500' }, { units: { day: '8,000', peak: '30,000', offPeak: '3,000', export: '' } }));
  assert.ok(r.battery.nightChargeKw > 100);
  assert.equal(r.battery.nightDemandRisk, true);
  assert.equal(calculateTou(withBattery()).battery.nightDemandRisk, false);
});

// ------------------------------------------------------------ returns

test('returns: simple payback, maintenance, battery replacement and NPV', () => {
  const finance = { maintenance: 0.01, batteryLife: 10, replacement: 0.6, batteryLoss: 0, solarLoss: 0, discountRate: 0 };
  const r = investmentReturns({ solarMonthly: 100000, batteryMonthly: 50000, investment: 10000000, batteryCost: 4000000, hasBattery: true, finance });
  close(r.firstYearNet, 150000 * 12 - 100000, 1e-6);
  close(r.simplePaybackYears, 10000000 / 1700000, 1e-9);
  close(r.paybackYears, 10000000 / 1700000, 1e-9); // no ageing: the same as simple payback
  assert.deepEqual(r.replacementYears, [11]);
  close(r.yearly[10].replacement, 2400000, 1e-6);
  close(r.npv, 1700000 * 20 - 2400000 - 10000000, 1e-3); // 0% discount: plain sum
  assert.deepEqual(r.milestones.map((m) => m.year), [5, 10, 15, 20]);
  close(r.cumulative[20], r.netGain, 1e-6);
});

test('returns: ageing slows the savings, and the battery is as good as new after replacement', () => {
  const finance = { maintenance: 0, batteryLife: 10, replacement: 0.6, batteryLoss: 0.02, solarLoss: 0.005, discountRate: 0.1 };
  const r = investmentReturns({ solarMonthly: 100000, batteryMonthly: 50000, investment: 10000000, batteryCost: 4000000, hasBattery: true, finance });
  close(r.yearly[1].saving, 12 * (100000 * 0.995 + 50000 * 0.98), 1e-6);
  close(r.yearly[10].saving, 12 * (100000 * 0.995 ** 10 + 50000), 1e-6);
  assert.ok(r.paybackYears > r.simplePaybackYears);
});

test('tariffs without built-in rates leave the rates to be typed', () => {
  assert.equal(tariffRateFields('I-3'), null);
  assert.equal(tariffRateFields('GP-3'), null);
  assert.ok(ratesMatchTariff({ tariff: 'I-3', rates: {} }));
});

test('standard calculator still gives the original example result (2 years 5 months)', () => {
  const r = calculate(defaultInputs);
  close(r.totalMonthlyIncome, 24378 + (533 - 465) * 20.9);
  assert.deepEqual([r.payback.years, r.payback.months], [2, 5]);
});
