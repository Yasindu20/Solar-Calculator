import { assumptions } from '../config/company.js';
import { rs, rsRate, units, num, tonnes } from '../lib/format.js';

export function EnergySplit({ results: r }) {
  const surplus = r.unitBalance >= 0;
  const total = surplus ? r.generation : r.usage;
  const first = surplus ? r.usage : r.generation;
  const second = Math.abs(r.unitBalance);
  const firstLabel = surplus ? 'Covers your own usage' : 'Covered by solar';
  const secondLabel = surplus ? 'Sold to the grid' : 'Bought from the grid';
  const share = total > 0 ? first / total : 0;

  return (
    <figure className="split">
      <div
        className="split-bar"
        role="img"
        aria-label={`${units(first)} ${firstLabel.toLowerCase()}, ${units(second)} ${secondLabel.toLowerCase()}`}
      >
        {total > 0 ? (
          <>
            {first > 0 && (
              <span className="seg seg-own" style={{ flexGrow: first }}>
                {share > 0.3 && units(first)}
              </span>
            )}
            {second > 0 && <span className={`seg ${surplus ? 'seg-export' : 'seg-grid'}`} style={{ flexGrow: second }} />}
          </>
        ) : (
          <span className="seg seg-empty" />
        )}
      </div>
      <dl className="statement">
        <div>
          <dt>
            <i className="key key-own" aria-hidden="true" />
            {firstLabel}
          </dt>
          <dd>{units(first)}</dd>
        </div>
        <div>
          <dt>
            <i className={`key ${surplus ? 'key-export' : 'key-grid'}`} aria-hidden="true" />
            {secondLabel}
          </dt>
          <dd>{units(second)}</dd>
        </div>
        <div className="statement-total">
          <dt>{surplus ? 'Solar generated' : 'Your usage'}</dt>
          <dd>{units(total)}</dd>
        </div>
      </dl>
    </figure>
  );
}

export function MonthlyBenefit({ results: r }) {
  const surplus = r.unitBalance >= 0;
  const balance = Math.abs(Math.round(r.unitBalance));
  return (
    <dl className="statement">
      <div>
        <dt>Electricity bill saved</dt>
        <dd>{rs(r.lightBill)}</dd>
      </div>
      <div>
        <dt>
          {surplus ? 'Export income' : 'Extra units from the grid'}
          <small>
            {num(balance)} {balance === 1 ? 'unit' : 'units'} × {rsRate(r.unitValue)}
          </small>
        </dt>
        <dd className={r.monthlyUnitIncome < 0 ? 'is-negative' : undefined}>{rs(r.monthlyUnitIncome)}</dd>
      </div>
      <div className="statement-sum">
        <dt>Total monthly benefit</dt>
        <dd>{rs(r.totalMonthlyIncome)}</dd>
      </div>
    </dl>
  );
}

export function IncomeTotals({ results: r }) {
  const cells = [
    { label: '1-year income', value: r.yearIncome },
    { label: '10-year income', value: r.year10Income },
    { label: `${r.years}-year income`, value: r.year20Income },
    { label: `${r.years}-year net gain`, value: r.netGain, note: 'After the system cost', gain: true },
  ];
  return (
    <dl className="totals">
      {cells.map((c) => (
        <div key={c.label} className={c.gain ? (c.value >= 0 ? 'is-gain' : 'is-loss') : undefined}>
          <dt>{c.label}</dt>
          <dd>{rs(c.value)}</dd>
          {c.note && <p>{c.note}</p>}
        </div>
      ))}
    </dl>
  );
}

export function CleanEnergy({ results: r }) {
  if (!assumptions.showCleanEnergy || r.generation <= 0) return null;
  return (
    <p className="clean">
      <svg className="leaf" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 21c0-9 6-16 18-18 0 11-6 18-15 18H3z" />
      </svg>
      <span>
        <strong>Clean energy:</strong> about {tonnes(r.co2PerYearKg)} tonnes of CO<sub>2</sub> avoided each year and{' '}
        {tonnes(r.co2TotalKg)} tonnes over {r.years} years, as much as {num(r.treesEquivalent)} mature trees absorb in a
        year.
      </span>
    </p>
  );
}
