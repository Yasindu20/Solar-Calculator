import { assumptions } from '../config/company.js';

// Turns a field value such as "750,000" or "20.90" into a number (blank → 0).
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Splits a payback period in months into whole years and months.
// Rounds to the nearest month first, so 35.6 months is "3 years", never "2 years 12 months".
export function splitPayback(months) {
  if (months == null || !Number.isFinite(months)) return null;
  const total = Math.round(months);
  return { years: Math.floor(total / 12), months: total % 12, exactMonths: months };
}

// The calculation is the same as the original calculator:
//   surplus units × unit value + the light bill no longer paid = monthly benefit,
// with 1, 10 and 20-year totals, annual ROI and payback built from it.
export function calculate(input) {
  const generation = toNumber(input.generation);
  const usage = toNumber(input.usage);
  const unitValue = toNumber(input.unitValue);
  const lightBill = toNumber(input.lightBill);
  const investment = toNumber(input.investment);

  const unitBalance = generation - usage; // surplus (+) or shortfall (−) in units
  const monthlyUnitIncome = unitBalance * unitValue;
  const totalMonthlyIncome = lightBill + monthlyUnitIncome;
  const yearIncome = totalMonthlyIncome * 12;
  const year10Income = totalMonthlyIncome * 120;
  const year20Income = totalMonthlyIncome * 240;

  const roi = investment > 0 ? (yearIncome / investment) * 100 : 0;

  // null when there is no system cost to recover, or the benefit never recovers it.
  const hasCost = investment > 0;
  const paybackMonths = hasCost && totalMonthlyIncome > 0 ? investment / totalMonthlyIncome : null;

  const years = assumptions.projectionYears;
  // Where the customer stands at the end of each year, after paying for the system.
  const cumulative = Array.from({ length: years + 1 }, (_, y) => yearIncome * y - investment);
  const netGain = yearIncome * years - investment;

  const annualGeneration = generation * 12;
  const co2PerYearKg = annualGeneration * assumptions.co2KgPerUnit;
  const co2TotalKg = co2PerYearKg * years;
  const treesEquivalent = co2PerYearKg / assumptions.co2KgPerTreePerYear;

  return {
    generation,
    usage,
    unitValue,
    lightBill,
    investment,
    unitBalance,
    monthlyUnitIncome,
    totalMonthlyIncome,
    yearIncome,
    year10Income,
    year20Income,
    roi,
    hasCost,
    paybackMonths,
    payback: splitPayback(paybackMonths),
    paybackYears: paybackMonths == null ? null : paybackMonths / 12,
    years,
    cumulative,
    netGain,
    annualGeneration,
    co2PerYearKg,
    co2TotalKg,
    treesEquivalent,
  };
}
