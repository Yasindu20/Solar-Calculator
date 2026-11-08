import { useMemo, useRef } from 'react';
import { defaultInputs } from '../config/company.js';
import { calculate } from '../lib/calc.js';
import { rs, percent } from '../lib/format.js';
import { useInView, useReportDownload } from '../lib/hooks.js';
import { NumberField, TextField } from '../components/NumberField.jsx';
import { ResultPanel, MobileBar } from '../components/ResultPanel.jsx';
import { CashChart, CashTable } from '../components/CashChart.jsx';
import { EnergySplit, MonthlyBenefit, IncomeTotals, CleanEnergy } from '../components/Details.jsx';

const ENERGY_FIELDS = [
  { name: 'generation', label: 'Solar generation per month', suffix: 'units', hint: 'Units (kWh) the system produces in a typical month' },
  { name: 'usage', label: 'Electricity used per month', suffix: 'units', hint: 'Units shown on your monthly bill' },
];

const MONEY_FIELDS = [
  { name: 'lightBill', label: 'Monthly electricity bill', prefix: 'Rs.', hint: 'Your average CEB or LECO bill before solar' },
  { name: 'unitValue', label: 'Payment per surplus unit', prefix: 'Rs.', decimals: 2, hint: 'What the utility pays for each unit sold to the grid' },
  { name: 'investment', label: 'System cost', prefix: 'Rs.', hint: 'Total installed price' },
];

// Section 1: bills that show one total of units (homes and small shops).
export function StandardCalculator({ values, setValues }) {
  const results = useMemo(() => calculate(values), [values]);
  const panelRef = useRef(null);
  const panelInView = useInView(panelRef);
  const { download, busy, failed } = useReportDownload(() => ({
    kind: 'standard',
    results,
    details: { customerName: values.customerName, location: values.location, systemSize: values.systemSize },
  }));

  const set = (name) => (value) => setValues((prev) => ({ ...prev, [name]: value }));
  const r = results;

  return (
    <>
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

        <ResultPanel
          results={r}
          figures={[
            { label: 'Monthly benefit', value: rs(r.totalMonthlyIncome) },
            { label: 'Annual return', value: r.hasCost ? percent(r.roi) : '—' },
            { label: `${r.years}-year net gain`, value: rs(r.netGain) },
          ]}
          noBenefitNote="The monthly benefit is below zero. Check the bill, usage and generation figures."
          onDownload={download}
          busy={busy}
          failed={failed}
          panelRef={panelRef}
        />
      </div>

      <section className="sheet" aria-label="Detailed results">
        <div className="sheet-row">
          <div className="sheet-block">
            <h2>Energy each month</h2>
            <EnergySplit results={r} />
          </div>
          <div className="sheet-block">
            <h2>Your monthly benefit</h2>
            <MonthlyBenefit results={r} />
          </div>
        </div>

        <CashBlock results={r} />

        <div className="sheet-block">
          <h2>Income over time</h2>
          <IncomeTotals results={r} />
          <CleanEnergy results={r} />
        </div>
      </section>

      <MobileBar results={r} visible={!panelInView} onDownload={download} busy={busy} />
    </>
  );
}

// The 20-year cash position chart with its legend and the yearly table. Shared by both sections.
export function CashBlock({ results }) {
  return (
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
  );
}
