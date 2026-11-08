import { touPeriods } from '../../config/tariffs.js';
import { formatTyped, num, qty, rs, rsRate, units } from '../../lib/format.js';

const LINES = [
  { key: 'day', label: touPeriods.day.label, when: touPeriods.day.window, unit: 'units', per: 'per unit' },
  { key: 'peak', label: touPeriods.peak.label, when: touPeriods.peak.window, unit: 'units', per: 'per unit' },
  { key: 'offPeak', label: touPeriods.offPeak.label, when: touPeriods.offPeak.window, unit: 'units', per: 'per unit' },
  { key: 'demand', label: 'Max demand', unit: 'kVA', per: 'per kVA' },
  { key: 'fixed', label: 'Fixed charge' },
];

// Green where solar or the battery brings a line down; marked where it goes up (overnight charging).
const changedClass = (base, value) => {
  if (value < base - 0.004) return 'is-changed';
  if (value > base + 0.004) return 'is-higher';
  return undefined;
};

// The bill as CEB/EDL and LECO lay it out: today, with solar, and with solar and a battery.
export function BillTable({ results: r }) {
  const columns = [
    { key: 'today', label: 'Today', bill: r.today },
    { key: 'solar', label: r.netPlus ? 'With Net Plus' : 'With solar', bill: r.withSolar },
  ];
  if (r.battery.on) columns.push({ key: 'battery', label: 'Solar + battery', bill: r.withBattery });
  const base = r.today;
  return (
    <div className="bill-scroll">
      <table className={`bill-table${columns.length > 2 ? ' bill-table-3' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Charge</th>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map(({ key, label, when, unit, per }) => {
            const a = base.lines[key];
            return (
              <tr key={key}>
                <th scope="row">
                  <span className="bill-name">{label}</span>
                  {when && <span className="bill-when"> {when}</span>}
                  {a.rate != null && (
                    <small>
                      {key === 'demand' ? `Rs. ${formatTyped(a.rate, 'auto')}` : rsRate(a.rate)} {per}
                    </small>
                  )}
                </th>
                {columns.map((c) => {
                  const line = c.bill.lines[key];
                  return (
                    <td key={c.key} className={c.key === 'today' ? undefined : changedClass(a.amount, line.amount)}>
                      {num(line.amount)}
                      {line.quantity != null && (
                        <small>
                          {qty(key === 'demand' ? line.quantity : Math.round(line.quantity))} {unit}
                        </small>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="bill-sub">
            <th scope="row">Charges</th>
            {columns.map((c) => (
              <td key={c.key} className={c.key === 'today' ? undefined : changedClass(base.charges, c.bill.charges)}>
                {num(c.bill.charges)}
              </td>
            ))}
          </tr>
          {r.sscl && (
            <tr>
              <th scope="row">
                SSC Levy<small>2.5% of the total</small>
              </th>
              {columns.map((c) => (
                <td key={c.key} className={c.key === 'today' ? undefined : changedClass(base.levy, c.bill.levy)}>
                  {num(c.bill.levy)}
                </td>
              ))}
            </tr>
          )}
          <tr className="bill-total">
            <th scope="row">Monthly bill</th>
            {columns.map((c) => (
              <td key={c.key} className={c.key !== 'today' && c.bill.total < base.total - 0.004 ? 'is-lower' : undefined}>
                {rs(c.bill.total)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, note, value, negative, muted }) {
  return (
    <div className={muted ? 'is-muted' : undefined}>
      <dt>
        {label}
        {note && <small>{note}</small>}
      </dt>
      <dd className={negative ? 'is-negative' : undefined}>{value}</dd>
    </div>
  );
}

// Where the monthly saving comes from. Battery lines are shown before their charging cost,
// which is subtracted, so nothing is counted twice.
export function SavingsBreakdown({ results: r, noun }) {
  const b = r.battery;
  const p = b.plan;
  const levyNote = r.sscl ? ', with the levy' : '';
  return (
    <>
      <dl className="statement statement-grouped">
        <p className="statement-group">Solar</p>
        <Row
          label={r.netPlus ? 'Bill saved' : 'Day units replaced'}
          note={r.netPlus ? 'Net Plus leaves the bill as it is' : `${units(r.solarToDay)} × ${rsRate(r.rates.day)}${levyNote}`}
          value={rs(r.billSaving)}
        />
        {(r.netPlus || r.soldUnits > 0) && (
          <Row
            label={r.netPlus ? 'Units sold (Net Plus)' : 'Surplus sold'}
            note={`${units(r.soldUnits)} × ${rsRate(r.exportRate)}`}
            value={rs(r.solarIncome)}
          />
        )}

        {b.on && (
          <>
            <p className="statement-group">Battery</p>
            {p.peak > 0 && (
              <Row label="Peak units replaced" note={`${units(p.peak)} × ${rsRate(r.rates.peak)}${levyNote}`} value={rs(b.parts.peak)} />
            )}
            {p.offPeak > 0 && (
              <Row
                label="Off-peak units replaced"
                note={`${units(p.offPeak)} × ${rsRate(r.rates.offPeak)}${levyNote}`}
                value={rs(b.parts.offPeak)}
              />
            )}
            {b.demandCounted > 0 ? (
              <Row
                label="Max demand"
                note={`${qty(b.demandCounted)} kVA × Rs. ${formatTyped(r.rates.demand, 'auto')}, confirmed from load data`}
                value={rs(b.parts.demand)}
              />
            ) : (
              <Row
                label="Max demand"
                note={
                  b.demandPossible > 0
                    ? `Not counted: about ${rs(b.demandPossibleSaving)} if load data confirms ${qty(b.demandPossible)} kVA`
                    : 'Not counted: needs half-hourly load data'
                }
                value={rs(0)}
                muted
              />
            )}
            {p.chargedIn > 0 && (
              <Row label="Charging cost" note={chargingNote(r)} value={rs(-b.parts.charging)} negative />
            )}
          </>
        )}

        <div className="statement-sum">
          <dt>Total monthly {noun}</dt>
          <dd>{rs(r.totalMonthlyIncome)}</dd>
        </div>
      </dl>
      {b.on && (
        <p className="statement-foot">
          Battery figures are estimates from the bill’s monthly units. Max-demand savings count only once half-hourly load data
          confirms them.
        </p>
      )}
    </>
  );
}

function chargingNote(r) {
  const c = r.battery.plan.charge;
  const parts = [];
  if (c.grid > 0) parts.push(`${units(c.grid)} from the grid × ${rsRate(r.rates.offPeak)}`);
  if (c.daySolar > 0) parts.push(`${units(c.daySolar)} of solar that was replacing Day units`);
  if (c.surplus > 0) parts.push(`${units(c.surplus)} of surplus solar not sold`);
  return parts.join(', ');
}

// One bar per time-of-use period, so it's plain what solar and the battery each reach.
export function UnitsByTime({ results: r }) {
  const b = r.battery;
  const p = b.plan;
  const daySolarInBattery = b.on ? p.charge.daySolar : 0;
  const solarOnDay = r.netPlus ? 0 : Math.max(0, r.solarToDay - daySolarInBattery);
  const rows = [
    {
      key: 'day',
      label: touPeriods.day.label,
      parts: [
        { kind: 'own', value: solarOnDay },
        { kind: 'grid', value: r.withBattery.lines.day.quantity },
      ],
    },
    {
      key: 'peak',
      label: touPeriods.peak.label,
      parts: [
        { kind: 'battery', value: b.on ? p.peak : 0 },
        { kind: 'grid', value: r.peakUnits - (b.on ? p.peak : 0) },
      ],
    },
    {
      key: 'offPeak',
      label: touPeriods.offPeak.label,
      parts: [
        { kind: 'battery', value: b.on ? p.offPeak : 0 },
        { kind: 'grid', value: r.offPeakUnits - (b.on ? p.offPeak : 0) },
      ],
    },
  ];
  if (b.on && p.chargedIn > 0) {
    rows.push({
      key: 'charge',
      label: 'Charging',
      parts: [
        { kind: 'own', value: p.charge.surplus + p.charge.daySolar },
        { kind: 'grid', value: p.charge.grid },
      ],
    });
  }
  const sold = r.netPlus ? r.soldUnits : Math.max(0, r.soldUnits - (b.on ? p.charge.surplus : 0));
  if (sold > 0) rows.push({ key: 'sold', label: r.netPlus ? 'Sold' : 'Surplus', parts: [{ kind: 'sold', value: sold }] });

  const totals = rows.map((row) => row.parts.reduce((sum, part) => sum + part.value, 0));
  const max = Math.max(1, ...totals);
  const names = { own: 'from solar', grid: 'from the grid', battery: 'from the battery', sold: 'sold to the grid' };
  const used = new Set(rows.flatMap((row) => row.parts.filter((part) => part.value > 0).map((part) => part.kind)));
  const legend = [
    { kind: 'own', label: 'From solar' },
    { kind: 'battery', label: 'From the battery' },
    { kind: 'grid', label: 'From the grid' },
    { kind: 'sold', label: 'Sold to the grid' },
  ].filter((l) => used.has(l.kind));

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
          const parts = row.parts.filter((part) => part.value > 0.5);
          const description = parts.length ? parts.map((part) => `${units(part.value)} ${names[part.kind]}`).join(', ') : 'none';
          return (
            <div className={`tou-bar-row${row.key === 'charge' ? ' is-charge' : ''}`} key={row.key}>
              <span className="tou-bar-label">{row.label}</span>
              <span className="tou-bar-track" role="img" aria-label={`${row.label}: ${description}`}>
                <span className="tou-bar-fill" style={{ width: `${(totals[i] / max) * 100}%` }}>
                  {parts.map((part) => (
                    <span key={part.kind} className={`tou-seg tou-seg-${part.kind}`} style={{ flexGrow: part.value }} />
                  ))}
                </span>
              </span>
              <span className="tou-bar-value">{qty(Math.round(totals[i]))}</span>
            </div>
          );
        })}
      </div>
      <figcaption>
        {b.on
          ? 'Solar covers daytime use. The battery stores energy and hands it back when grid units cost the most; the Charging row is the energy it takes in each month.'
          : r.netPlus
            ? 'With Net Plus every unit is sold, so the units bought from the grid stay the same.'
            : 'Panels only produce in daylight, so solar replaces Day units. Peak and Off-peak units are used after dark and stay on the bill.'}
      </figcaption>
    </figure>
  );
}

const yearsText = (y) => (y == null ? 'Not within 60 years' : `${formatTyped(Math.round(y * 10) / 10, 'auto')} years`);

// Investment, the yearly figures behind the payback, and where the customer stands over time.
export function Returns({ results: r }) {
  const parts = [`solar ${rs(r.costs.solar)}`];
  if (r.battery.on) parts.push(`battery ${rs(r.costs.battery)}`);
  if (r.costs.other > 0) parts.push(`other ${rs(r.costs.other)}`);
  return (
    <>
      <dl className="facts">
        <div>
          <dt>Total investment</dt>
          <dd>{rs(r.investment)}</dd>
          <p>{parts.join(' + ')}</p>
        </div>
        <div>
          <dt>Net saving, first year</dt>
          <dd>{rs(r.firstYearNet)}</dd>
          <p>After {rs(r.maintenance)} of maintenance</p>
        </div>
        <div>
          <dt>Simple payback</dt>
          <dd>{r.hasCost ? yearsText(r.simplePaybackYears) : '—'}</dd>
          <p>Investment ÷ first-year net saving</p>
        </div>
        <div>
          <dt>Net present value</dt>
          <dd className={r.npv < 0 ? 'is-negative' : undefined}>{rs(r.npv)}</dd>
          <p>
            Over {r.years} years at {formatTyped(r.discountRate * 100, 'auto')}% a year
          </p>
        </div>
      </dl>

      <dl className="totals totals-milestones">
        {r.milestones.map((m) => (
          <div key={m.year} className={m.position >= 0 ? 'is-gain' : 'is-loss'}>
            <dt>After {m.year} years</dt>
            <dd>{rs(m.position)}</dd>
            <p>{m.position >= 0 ? 'Ahead, after the investment' : 'Still to recover'}</p>
          </div>
        ))}
      </dl>
      <p className="returns-note">
        Savings shrink as panels{r.battery.on ? ' and the battery' : ''} age ({formatTyped(r.finance.solarLoss * 100, 'auto')}%
        {r.battery.on ? ` and ${formatTyped(r.finance.batteryLoss * 100, 'auto')}%` : ''} a year), and maintenance of{' '}
        {rs(r.maintenance)} is paid every year.
        {r.replacementYears.length > 0 &&
          ` Year ${r.replacementYears.join(' and ')} includes replacing the battery for ${rs(r.finance.replacement * r.costs.battery)}.`}
      </p>
    </>
  );
}
