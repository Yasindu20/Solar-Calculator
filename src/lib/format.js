const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const twoDp = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const upTo2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const MINUS = '−';

// Rs. 25,799  ·  −Rs. 130,824
export function rs(amount) {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? MINUS : '';
  return `${sign}Rs. ${whole.format(Math.abs(rounded))}`;
}

export function rsRate(amount) {
  return `Rs. ${twoDp.format(amount)}`;
}

export function num(n) {
  const rounded = Math.round(n);
  return (rounded < 0 ? MINUS : '') + whole.format(Math.abs(rounded));
}

export function units(n) {
  const rounded = Math.round(Math.abs(n));
  return `${whole.format(rounded)} ${rounded === 1 ? 'unit' : 'units'}`;
}

export function percent(n) {
  const rounded = Math.round(n);
  return `${rounded < 0 ? MINUS : ''}${whole.format(Math.abs(rounded))}%`;
}

// Rs. 2.5M, Rs. 750K — for chart axes
export function rsCompact(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? MINUS : '';
  if (abs >= 1e6) return `${sign}${upTo2.format(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${upTo2.format(abs / 1e3)}K`;
  return `${sign}${whole.format(abs)}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "2 years 5 months", "1 year", "8 months"
export function paybackLong(payback) {
  if (!payback) return 'No payback with these figures';
  const { years, months } = payback;
  if (years === 0 && months === 0) return 'Under a month';
  if (years === 0) return plural(months, 'month', 'months');
  if (months === 0) return plural(years, 'year', 'years');
  return `${plural(years, 'year', 'years')} ${plural(months, 'month', 'months')}`;
}

// "2 yrs 5 mths" — for tight spaces
export function paybackShort(payback) {
  if (!payback) return 'No payback';
  const { years, months } = payback;
  if (years === 0 && months === 0) return 'Under a month';
  const y = years ? `${years} ${years === 1 ? 'yr' : 'yrs'}` : '';
  const m = months ? `${months} ${months === 1 ? 'mth' : 'mths'}` : '';
  return [y, m].filter(Boolean).join(' ');
}

// Pieces for typographic display: [{ value: '2', unit: 'years' }, { value: '5', unit: 'months' }]
export function paybackParts(payback) {
  if (!payback) return null;
  const { years, months } = payback;
  if (years === 0 && months === 0) return [{ value: '<1', unit: 'month' }];
  const parts = [];
  if (years > 0) parts.push({ value: String(years), unit: years === 1 ? 'year' : 'years' });
  if (months > 0) parts.push({ value: String(months), unit: months === 1 ? 'month' : 'months' });
  return parts;
}

export function tonnes(kg) {
  const t = kg / 1000;
  return t >= 10 ? whole.format(Math.round(t)) : upTo2.format(Math.round(t * 10) / 10);
}

// Formats what someone typed in a money/units field: "750000" → "750,000".
// decimals: a fixed number of places, or 'auto' for up to two.
export function formatTyped(value, decimals = 0) {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  if (raw === '') return '';
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return '';
  const auto = decimals === 'auto';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: auto ? 0 : decimals,
    maximumFractionDigits: auto ? 2 : decimals,
  }).format(n);
}
