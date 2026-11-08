import { touPeriods } from '../../config/tariffs.js';
import { formatTyped, num, qty, rs, rsRate, units } from '../../lib/format.js';

const LINES = [
  { key: 'day', label: touPeriods.day.label, when: touPeriods.day.window, unit: 'units', per: 'per unit' },
  { key: 'peak', label: touPeriods.peak.label, when: touPeriods.peak.window, unit: 'units', per: 'per unit' },
  { key: 'offPeak', label: touPeriods.offPeak.label, when: touPeriods.offPeak.window, unit: 'units', per: 'per unit' },
  { key: 'demand', label: 'Max demand', unit: 'kVA', per: 'per kVA' },
  { key: 'fixed', label: 'Fixed charge' },
];

const differs = (a, b) => Math.abs(a - b) > 0.004;

// The bill as CEB/EDL and LECO lay it out, today and with the solar system.
export function BillTable({ results: r }) {
  const after = r.netPlus ? 'With Net Plus' : 'With solar';
  return (
    <table className="bill-table">
      <thead>
        <tr>
          <th scope="col">Charge</th>
          <th scope="col">Today</th>
          <th scope="col">{after}</th>
        </tr>
      </thead>
      <tbody>
        {LINES.map(({ key, label, when, unit, per }) => {
          const a = r.today.lines[key];
          const b = r.withSolar.lines[key];
          return (
            <tr key={key}>
              <th scope="row">
                {label}
                {when && <span className="bill-when"> {when}</span>}
                {a.rate != null && (
                  <small>
                    {key === 'demand' ? `Rs. ${formatTyped(a.rate, 'auto')}` : rsRate(a.rate)} {per}
                  </small>
                )}
              </th>
              <td>
                {num(a.amount)}
                {a.quantity != null && (
                  <small>
                    {qty(a.quantity)} {unit}
                  </small>
                )}
              </td>
              <td className={differs(a.amount, b.amount) ? 'is-changed' : undefined}>
                {num(b.amount)}
                {b.quantity != null && (
                  <small>
                    {qty(b.quantity)} {unit}
                  </small>
                )}
              </td>
            </tr>
          );
        })}
        <tr className="bill-sub">
          <th scope="row">Charges</th>
          <td>{num(r.today.charges)}</td>
          <td className={differs(r.today.charges, r.withSolar.charges) ? 'is-changed' : undefined}>{num(r.withSolar.charges)}</td>
        </tr>
        {r.sscl && (
          <tr>
            <th scope="row">
              SSC Levy<small>2.5% of the total</small>
            </th>
            <td>{num(r.today.levy)}</td>
            <td className={differs(r.today.levy, r.withSolar.levy) ? 'is-changed' : undefined}>{num(r.withSolar.levy)}</td>
          </tr>
        )}
        <tr className="bill-total">
          <th scope="row">Monthly bill</th>
          <td>{rs(r.today.total)}</td>
          <td>{rs(r.withSolar.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// Bill saved + units sold = the monthly benefit.
export function TouBenefit({ results: r, noun }) {
  return (
    <dl className="statement">
      <div>
        <dt>
          Bill saved
          <small>
            {r.netPlus ? 'Net Plus leaves the bill as it is' : `${units(r.solarToDay)} replaced by solar, plus the levy on them`}
          </small>
        </dt>
        <dd>{rs(r.billSaving)}</dd>
      </div>
      {(r.netPlus || r.soldUnits > 0) && (
        <div>
          <dt>
            {r.netPlus ? 'Units sold' : 'Surplus sold'}
            <small>
              {units(r.soldUnits)} × {rsRate(r.exportRate)}
            </small>
          </dt>
          <dd>{rs(r.solarIncome)}</dd>
        </div>
      )}
      <div className="statement-sum">
        <dt>Total monthly {noun}</dt>
        <dd>{rs(r.totalMonthlyIncome)}</dd>
      </div>
    </dl>
  );
}

// One bar per time-of-use period, so it's plain that solar only reaches Day units.
export function UnitsByTime({ results: r }) {
  const rows = [
    {
      key: 'day',
      label: touPeriods.day.label,
      parts: r.netPlus
        ? [{ kind: 'grid', value: r.dayUnits }]
        : [
            { kind: 'own', value: r.solarToDay },
            { kind: 'grid', value: r.dayBalance },
          ],
    },
    { key: 'peak', label: touPeriods.peak.label, parts: [{ kind: 'grid', value: r.peakUnits }] },
    { key: 'offPeak', label: touPeriods.offPeak.label, parts: [{ kind: 'grid', value: r.offPeakUnits }] },
  ];
  if (r.soldUnits > 0) {
    rows.push({ key: 'sold', label: r.netPlus ? 'Sold' : 'Surplus', parts: [{ kind: 'export', value: r.soldUnits }] });
  }
  const totals = rows.map((row) => row.parts.reduce((sum, p) => sum + p.value, 0));
  const max = Math.max(1, ...totals);
  const names = { own: 'from solar', grid: 'from the grid', export: 'sold to the grid' };

  const legend = [
    !r.netPlus && r.solarToDay > 0 && { kind: 'own', label: 'From solar' },
    { kind: 'grid', label: 'From the grid' },
    r.soldUnits > 0 && { kind: 'export', label: 'Sold to the grid' },
  ].filter(Boolean);

  return (
    <figure className="tou-bars">
      <ul className="legend" aria-label="Legend">
        {legend.map((l) => (
          <li key={l.kind}>
            <i className={`key key-${l.kind}`} aria-hidden="true" />
            {l.label}
          </li>
        ))}
      </ul>
      <div className="tou-bar-list">
        {rows.map((row, i) => {
          const parts = row.parts.filter((p) => p.value > 0);
          const description = parts.length
            ? parts.map((p) => `${units(p.value)} ${names[p.kind]}`).join(', ')
            : 'none';
          return (
            <div className="tou-bar-row" key={row.key}>
              <span className="tou-bar-label">{row.label}</span>
              <span className="tou-bar-track" role="img" aria-label={`${row.label}: ${description}`}>
                <span className="tou-bar-fill" style={{ width: `${(totals[i] / max) * 100}%` }}>
                  {parts.map((p) => (
                    <span key={p.kind} className={`tou-seg tou-seg-${p.kind}`} style={{ flexGrow: p.value }} />
                  ))}
                </span>
              </span>
              <span className="tou-bar-value">{qty(totals[i])}</span>
            </div>
          );
        })}
      </div>
      <figcaption>
        {r.netPlus
          ? 'With Net Plus every unit is sold, so the units bought from the grid stay the same.'
          : 'Panels only produce in daylight, so solar replaces Day units. Peak and Off-peak units are used after dark and stay on the bill.'}
      </figcaption>
    </figure>
  );
}
