// Checks the calculators against real bills. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculate } from '../src/lib/calc.js';
import { defaultInputs } from '../src/config/company.js';
import {
  calculateTou,
  monthlyBill,
  registerUnits,
  touDefaultInputs,
  clearedBillInputs,
  tariffRateFields,
  ratesMatchTariff,
} from '../src/lib/touCalc.js';

const close = (actual, expected, cents = 0.005) =>
  assert.ok(Math.abs(actual - expected) <= cents, `expected ${expected}, got ${actual}`);

const rates = (day, peak, offPeak, demand, fixed) => ({ day, peak, offPeak, demand, fixed });

const readingsInput = (readings, extra) => ({
  entry: 'readings',
  readings: { export: { prev: '', curr: '' }, ...readings },
  multiplier: '1',
  sscl: true,
  scheme: 'onsite',
  generation: '0',
  ...extra,
});

test('EDL (formerly CEB) industrial I-2 bill, October 2026 — reproduced to the cent', () => {
  const r = calculateTou(
    readingsInput(
      {
        day: { prev: '1,389,375', curr: '1,495,478' },
        peak: { prev: '236,602', curr: '261,290' },
        offPeak: { prev: '112,225', curr: '131,687' },
      },
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
    readingsInput(
      {
        day: { prev: '282,674', curr: '288,691' },
        peak: { prev: '95,563', curr: '101,156' },
        offPeak: { prev: '49,029', curr: '51,741' },
        export: { prev: '27,697', curr: '32,703' },
      },
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

test('the same May 2026 readings at today’s GP-2 rates flag a difference from the split bill', () => {
  const r = calculateTou(
    readingsInput(
      {
        day: { prev: '301,536', curr: '309,287' },
        peak: { prev: '114,238', curr: '120,885' },
        offPeak: { prev: '58,193', curr: '61,640' },
        export: { prev: '46,657', curr: '51,505' },
      },
      { maxDemand: '105', rates: tariffRateFields('GP-2'), billTotal: '973,321.44' },
    ),
  );
  assert.equal(r.dayUnits, 2903);
  assert.equal(r.totalUnits, 12997);
  assert.equal(r.today.charges, 999399);
  assert.ok(r.billDifference > 1, 'a whole month at the new rates costs more than the split bill');
});

test('typing units gives the same bill as typing readings', () => {
  const base = { maxDemand: '78', rates: rates('41', '47', '31', '1,500', '5,000'), sscl: true, scheme: 'onsite' };
  const fromUnits = calculateTou({
    ...base,
    entry: 'units',
    units: { day: '6,017', peak: '5,593', offPeak: '2,712', export: '5,006' },
  });
  close(fromUnits.today.total, 523481.03);
});

test('meter multiplier and reading problems', () => {
  const input = (prev, curr, multiplier = '1') => ({ entry: 'readings', multiplier, readings: { day: { prev, curr } } });
  assert.deepEqual(registerUnits(input('100', '250', '40'), 'day'), { units: 6000, status: 'ok' });
  assert.deepEqual(registerUnits(input('100', '250', ''), 'day'), { units: 150, status: 'ok' });
  assert.equal(registerUnits(input('250', '100'), 'day').status, 'reversed');
  assert.equal(registerUnits(input('', '100'), 'day').status, 'needs-previous');
  assert.equal(registerUnits(input('100', ''), 'day').status, 'needs-current');
  assert.equal(registerUnits(input('', ''), 'day').status, 'empty');
});

test('solar used on site replaces Day units only, and the levy falls with it', () => {
  const ex = touDefaultInputs(); // 8,000 Day / 6,000 Peak / 3,000 Off-peak, 100 kVA, GP-2, 50 kWp
  const r = calculateTou(ex);
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
  const r = calculateTou({ ...touDefaultInputs(), generation: '10,000', exportRate: '15.49' });
  assert.equal(r.solarToDay, 8000);
  assert.equal(r.dayBalance, 0);
  assert.equal(r.soldUnits, 2000);
  close(r.solarIncome, 2000 * 15.49);
  assert.equal(r.withSolar.lines.day.amount, 0);
});

test('Net Plus: the bill stays the same and every unit is paid', () => {
  const r = calculateTou({ ...touDefaultInputs(), scheme: 'netplus', exportRate: '20' });
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
  assert.equal(cleared.readings.day.prev, '');
  assert.equal(cleared.maxDemand, '');
  assert.deepEqual(cleared.rates, ex.rates);
  assert.equal(cleared.systemSize, ex.systemSize);
});

test('standard calculator still gives the original example result (2 years 5 months)', () => {
  const r = calculate(defaultInputs);
  close(r.totalMonthlyIncome, 24378 + (533 - 465) * 20.9);
  assert.deepEqual([r.payback.years, r.payback.months], [2, 5]);
});
