// Everything about the company that appears on the website and the PDF report.
// Edit this file to change contact details — nothing else needs to change.

export const company = {
  name: 'Ceylon Energy & Engineering Services',
  legalName: 'Ceylon Energy & Engineering Services (Pvt) Ltd',
  // Used as the prefix of report numbers, e.g. CEES-261026-1432
  reportPrefix: 'CEES',
  website: 'https://www.ceylonenergyservices.com/',
  websiteLabel: 'www.ceylonenergyservices.com',
  address: ['41 Bandarnayaka Road', 'Moratuwa 10300', 'Sri Lanka'],
  // Optional — shown in the website footer and on the PDF when filled in.
  phone: '',
  email: '',
  // The logo is src/assets/brand/logo.png (the round emblem from the company logo).
  // Set to true if you swap in a logo that already contains the company name,
  // so the name isn't printed twice next to it.
  logoIncludesName: false,
  // true puts a white panel behind the logo in the dark PDF header — only needed for
  // logos made for white paper. The current emblem has its own white rim.
  logoPanel: false,
};

// Assumptions used for the projections and the clean-energy estimate.
export const assumptions = {
  projectionYears: 20,
  // Sri Lanka's average grid carbon intensity is roughly 0.33 kg CO2 per unit (kWh)
  // (Ember / Our World in Data, 2025). Raise or lower it to match your preferred source.
  co2KgPerUnit: 0.33,
  // CO2 a mature tree absorbs in a year, used for the "trees" comparison.
  co2KgPerTreePerYear: 21.8,
  showCleanEnergy: true,
};

// The figures the calculator opens with (same as the previous calculator).
export const defaultInputs = {
  generation: '533',
  usage: '465',
  unitValue: '20.90',
  lightBill: '24,378',
  investment: '750,000',
  customerName: '',
  location: '',
  systemSize: '',
};
