import { useMemo, useRef, useState } from 'react';
import { company, defaultInputs } from './config/company.js';
import { calculate } from './lib/calc.js';
import { rs, percent, paybackParts, paybackShort } from './lib/format.js';
import { useInView } from './lib/hooks.js';
import { BrandMark } from './components/BrandMark.jsx';
import { NumberField, TextField } from './components/NumberField.jsx';
import { SunPath } from './components/SunPath.jsx';
import { CashChart, CashTable } from './components/CashChart.jsx';
import { EnergySplit, MonthlyBenefit, IncomeTotals, CleanEnergy } from './components/Details.jsx';

const ENERGY_FIELDS = [
  { name: 'generation', label: 'Solar generation per month', suffix: 'units', hint: 'Units (kWh) the system produces in a typical month' },
  { name: 'usage', label: 'Electricity used per month', suffix: 'units', hint: 'Units shown on your monthly bill' },
];

const MONEY_FIELDS = [
  { name: 'lightBill', label: 'Monthly electricity bill', prefix: 'Rs.', hint: 'Your average CEB or LECO bill before solar' },
  { name: 'unitValue', label: 'Payment per surplus unit', prefix: 'Rs.', decimals: 2, hint: 'What the utility pays for each unit sold to the grid' },
  { name: 'investment', label: 'System cost', prefix: 'Rs.', hint: 'Total installed price' },
];

function ResultPanel({ results: r, onDownload, busy, failed, panelRef }) {
  const parts = paybackParts(r.payback);
  const within = r.paybackYears != null && r.paybackYears <= r.years;
  const noCost = !r.hasCost;

  let lead = 'This system pays for itself in';
  let headline = null;
  if (noCost) {
    lead = 'Payback period';
    headline = 'Add the system cost';
  } else if (!parts) {
    lead = 'With these figures';
    headline = 'it doesn’t pay for itself';
  }

  return (
    <section className="result" ref={panelRef} aria-labelledby="result-lead">
      <p className="result-lead" id="result-lead">
        {lead}
      </p>
      {headline ? (
        <p className="payback payback-none">{headline}</p>
      ) : (
        <p className="payback">
          {parts.map((part) => (
            <span key={part.unit} className="payback-part">
              <span className="payback-num">{part.value}</span> <span className="payback-unit">{part.unit}</span>
            </span>
          ))}
        </p>
      )}

      <SunPath paybackYears={r.paybackYears} years={r.years} />

      {parts && !within && <p className="result-note">That’s longer than the {r.years}-year outlook.</p>}
      {!parts && !noCost && (
        <p className="result-note">The monthly benefit is below zero. Check the bill, usage and generation figures.</p>
      )}
      {noCost && <p className="result-note">Enter the total installed price to see when the system pays for itself.</p>}

      <dl className="result-figures">
        <div>
          <dt>Monthly benefit</dt>
          <dd>{rs(r.totalMonthlyIncome)}</dd>
        </div>
        <div>
          <dt>Annual return</dt>
          <dd>{noCost ? '—' : percent(r.roi)}</dd>
        </div>
        <div>
          <dt>{r.years}-year net gain</dt>
          <dd>{rs(r.netGain)}</dd>
        </div>
      </dl>

      <button type="button" className="download" onClick={onDownload} disabled={busy}>
        {busy ? 'Preparing your PDF…' : 'Download PDF report'}
      </button>
      {failed && (
        <p className="result-error" role="alert">
          The PDF couldn’t be created. Check your internet connection and try again.
        </p>
      )}
    </section>
  );
}

export default function App() {
  const [values, setValues] = useState(defaultInputs);
  const [status, setStatus] = useState('idle');
  const results = useMemo(() => calculate(values), [values]);
  const panelRef = useRef(null);
  const panelInView = useInView(panelRef);

  const set = (name) => (value) => setValues((prev) => ({ ...prev, [name]: value }));

  async function download() {
    if (status === 'working') return;
    setStatus('working');
    try {
      const { downloadReport } = await import('./lib/pdf/exportReport.js');
      await downloadReport({
        results,
        details: { customerName: values.customerName, location: values.location, systemSize: values.systemSize },
      });
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  const busy = status === 'working';

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <BrandMark />
          <a className="topbar-link" href={company.website} target="_blank" rel="noreferrer">
            {company.websiteLabel.replace(/^www\./, '')}
          </a>
        </div>
      </header>

      <main className="wrap">
        <div className="intro">
          <h1>Solar savings calculator</h1>
          <p>
            See how much a rooftop solar system saves and earns each month, and how soon it pays for itself. Then download
            the full report as a PDF.
          </p>
        </div>

        <div className="workspace">
          <form className="inputs" onSubmit={(e) => e.preventDefault()} noValidate>
            <fieldset>
              <legend>Energy</legend>
              {ENERGY_FIELDS.map((f) => (
                <NumberField key={f.name} {...f} value={values[f.name]} onChange={set(f.name)} />
              ))}
            </fieldset>

            <fieldset>
              <legend>Money</legend>
              {MONEY_FIELDS.map((f) => (
                <NumberField key={f.name} {...f} value={values[f.name]} onChange={set(f.name)} />
              ))}
            </fieldset>

            <fieldset>
              <legend>On the report</legend>
              <TextField label="Prepared for" optional placeholder="Customer name" value={values.customerName} onChange={set('customerName')} />
              <div className="field-pair">
                <TextField label="Location" optional placeholder="e.g. Moratuwa" value={values.location} onChange={set('location')} />
                <NumberField label="System size" optional suffix="kWp" decimals="auto" value={values.systemSize} onChange={set('systemSize')} />
              </div>
            </fieldset>

            <button type="button" className="reset" onClick={() => setValues(defaultInputs)}>
              Reset to example figures
            </button>
          </form>

          <ResultPanel results={results} onDownload={download} busy={busy} failed={status === 'error'} panelRef={panelRef} />
        </div>

        <section className="sheet" aria-label="Detailed results">
          <div className="sheet-row">
            <div className="sheet-block">
              <h2>Energy each month</h2>
              <EnergySplit results={results} />
            </div>
            <div className="sheet-block">
              <h2>Your monthly benefit</h2>
              <MonthlyBenefit results={results} />
            </div>
          </div>

          <div className="sheet-block">
            <div className="chart-head">
              <div>
                <h2>Your {results.years}-year cash position</h2>
                <p className="chart-sub">Where you stand at the end of each year after paying for the system</p>
              </div>
              <ul className="legend" aria-label="Legend">
                <li>
                  <i className="key key-behind" aria-hidden="true" />
                  Recovering the cost
                </li>
                <li>
                  <i className="key key-ahead" aria-hidden="true" />
                  Ahead
                </li>
              </ul>
            </div>
            <CashChart results={results} />
            <details className="year-details">
              <summary>Show the yearly figures</summary>
              <CashTable results={results} />
            </details>
          </div>

          <div className="sheet-block">
            <h2>Income over time</h2>
            <IncomeTotals results={results} />
            <CleanEnergy results={results} />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <p className="footer-name">{company.legalName}</p>
            <address>{company.address.join(', ')}</address>
          </div>
          <div className="footer-contact">
            <a href={company.website} target="_blank" rel="noreferrer">
              {company.websiteLabel}
            </a>
            {company.phone && <a href={`tel:${company.phone.replace(/\s+/g, '')}`}>{company.phone}</a>}
            {company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}
          </div>
        </div>
        <div className="wrap">
          <p className="footer-note">
            Figures are estimates based on the values entered and assume they stay the same every month. Actual results
            depend on weather, system performance, consumption and tariff revisions.
          </p>
        </div>
      </footer>

      <div className={`mobile-bar${panelInView ? '' : ' is-visible'}`} inert={panelInView}>
        <div className="mobile-bar-text">
          <span>{results.hasCost ? 'Pays for itself in' : 'Payback period'}</span>
          <strong>{results.hasCost ? paybackShort(results.payback) : 'Add the system cost'}</strong>
        </div>
        <button type="button" className="download" onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
    </>
  );
}
