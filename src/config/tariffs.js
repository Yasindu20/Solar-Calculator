// Time-of-use (TOU) tariffs for the second calculator — the one for bills that charge
// Day, Peak and Off-peak units separately, plus a maximum-demand (kVA) charge.
//
// When the PUCSL revises tariffs, update the rates here. The calculator's tariff picker,
// its example and the PDF all follow. Every rate also stays editable on the page,
// so a customer's bill can always be matched even before this file is updated.

// The three time-of-use periods, named and timed as they're printed on CEB/EDL and LECO bills.
export const touPeriods = {
  day: { label: 'Day', window: '05:30 – 18:30' },
  peak: { label: 'Peak', window: '18:30 – 22:30' },
  offPeak: { label: 'Off-peak', window: '22:30 – 05:30' },
};

// Rates in Rs. Energy per unit (kWh), max demand per kVA, fixed charge per month.
// Both sets are the tariff in force from 11 May 2026, checked against real bills:
//   GP-2 — LECO bill, May 2026 (consumption from 11 May)
//   I-2  — EDL (formerly CEB) bill, October 2026
export const touTariffs = [
  {
    id: 'GP-2',
    name: 'GP-2 · General purpose',
    description: 'Offices, shops, gyms, hospitals and other businesses',
    printedAs: 'GP_2 or GP-2',
    effective: '11 May 2026',
    rates: { day: 51, peak: 78, offPeak: 40, demand: 1800, fixed: 6000 },
  },
  {
    id: 'I-2',
    name: 'I-2 · Industrial',
    description: 'Factories and other industries',
    printedAs: 'Industrial (I2)',
    effective: '11 May 2026',
    rates: { day: 19, peak: 39, offPeak: 16.5, demand: 1650, fixed: 6000 },
  },
];

// Used when the bill is on a tariff that isn't listed above: the rates are typed from the bill.
export const OTHER_TARIFF = 'other';

export const touSettings = {
  // Social Security Contribution Levy. Bills add it as charges × 2.5 ÷ 97.5,
  // which makes it 2.5% of the final total.
  ssclRate: 0.025,
  // Rough monthly output of 1 kWp of panels in Sri Lanka, used to turn a system size into
  // expected units. The generation field stays editable for a site-specific estimate.
  unitsPerKwpPerMonth: 120,
  // Rs. paid for each unit sold to the grid. 15.49 is the generation payment rate printed on
  // LECO net-accounting bills. Net Plus feed-in rates depend on system size and agreement date,
  // so the page lets this be changed for each customer.
  exportRate: 15.49,
};

export function findTariff(id) {
  return touTariffs.find((t) => t.id === id) ?? null;
}
