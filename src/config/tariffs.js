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
// The GP-2 and I-2 rates are the tariff in force from 11 May 2026, checked against real bills:
//   GP-2 — LECO bill, May 2026 (consumption from 11 May)
//   I-2  — EDL (formerly CEB) bill, October 2026
// GP-3 and I-3 are listed with `rates: null` until their rates are confirmed from a bill or the
// PUCSL schedule; picking one leaves the rate boxes empty so they're typed from the bill.
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
    id: 'GP-3',
    name: 'GP-3 · General purpose, 11 kV',
    description: 'Large businesses supplied at 11 kV or above',
    printedAs: 'GP_3 or GP-3',
    rates: null,
  },
  {
    id: 'I-2',
    name: 'I-2 · Industrial',
    description: 'Factories and other industries',
    printedAs: 'Industrial (I2)',
    effective: '11 May 2026',
    rates: { day: 19, peak: 39, offPeak: 16.5, demand: 1650, fixed: 6000 },
  },
  {
    id: 'I-3',
    name: 'I-3 · Industrial, 11 kV',
    description: 'Large industries supplied at 11 kV or above',
    printedAs: 'Industrial (I3)',
    rates: null,
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

// Battery storage (BESS): typical figures for a lithium (LFP) system. In Engineering mode each one
// can be changed on the page after a site survey.
export const batteryDefaults = {
  // Share of the nameplate kWh the battery may use each day (depth of discharge).
  usable: 0.9,
  // Round trip: units delivered ÷ units put in, including inverter losses.
  efficiency: 0.88,
  // Charge-and-discharge cycles a month (one a day).
  daysPerMonth: 30,
  // Rs per kWh of battery, installed with its inverter (PCS). A placeholder estimate: set it to your
  // supplier's price. The battery cost on the page starts from this and can be typed over.
  pricePerKwh: 70000,
  // Power factor used to compare kW of battery charging with the kVA maximum demand.
  powerFactor: 0.95,
};

// Hours each period gives the battery: discharging at peak, charging overnight, charging from solar.
export const periodHours = { peak: 4, offPeak: 7, solar: 6 };

// Assumptions behind the year-by-year returns. All editable in Engineering mode.
export const financeDefaults = {
  maintenance: 0.01, // yearly maintenance and operating cost, as a share of the investment
  batteryLife: 10, // years before the battery is replaced
  replacement: 0.6, // replacement cost, as a share of today's battery cost
  batteryLoss: 0.02, // battery capacity lost each year
  solarLoss: 0.005, // panel output lost each year
  discountRate: 0.1, // for the net present value
};

export function findTariff(id) {
  return touTariffs.find((t) => t.id === id) ?? null;
}
