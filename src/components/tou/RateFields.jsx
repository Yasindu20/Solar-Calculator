import { useId, useRef } from 'react';
import { touTariffs, findTariff, OTHER_TARIFF } from '../../config/tariffs.js';
import { ratesMatchTariff } from '../../lib/touCalc.js';
import { rsExact } from '../../lib/format.js';
import { NumberField, NumberInput } from '../NumberField.jsx';

export function TariffField({ value, onChange }) {
  const id = useId();
  const tariff = findTariff(value);
  return (
    <div className="field">
      <label htmlFor={id}>Tariff on the bill</label>
      <div className="control control-select">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`}>
          {touTariffs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value={OTHER_TARIFF}>Another tariff · type its rates</option>
        </select>
        <svg className="select-chevron" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
          <path d="M1 1.5 6 6.5l5-5" />
        </svg>
      </div>
      <p className="hint" id={`${id}-hint`}>
        {tariff
          ? `${tariff.description}. Printed on the bill as ${tariff.printedAs}.`
          : 'Hotels, government, 11 kV supplies and other tariffs: type the rates from the bill below.'}
      </p>
    </div>
  );
}

// `spoken` keeps each rate's name distinct from the readings above it for screen readers.
const RATE_FIELDS = [
  { key: 'day', label: 'Day', spoken: ' rate', unit: 'per unit', decimals: 2 },
  { key: 'peak', label: 'Peak', spoken: ' rate', unit: 'per unit', decimals: 2 },
  { key: 'offPeak', label: 'Off-peak', spoken: ' rate', unit: 'per unit', decimals: 2 },
  { key: 'demand', label: 'Max demand', spoken: ' rate', unit: 'per kVA', decimals: 'auto' },
  { key: 'fixed', label: 'Fixed charge', unit: 'per month', decimals: 'auto' },
];

function RateInput({ label, spoken, unit, value, onChange, decimals }) {
  const id = useId();
  const ref = useRef(null);
  return (
    <div className="rate">
      <label htmlFor={id}>
        {label}
        {spoken && <span className="sr-only">{spoken}</span>}
      </label>
      <div className="control control-compact" onClick={() => ref.current?.focus()}>
        <span className="affix">Rs.</span>
        <NumberInput inputRef={ref} id={id} value={value} onChange={onChange} decimals={decimals} aria-describedby={`${id}-unit`} />
      </div>
      <span className="rate-unit" id={`${id}-unit`}>
        {unit}
      </span>
    </div>
  );
}

// Filled from the tariff, and every one can be changed to match the bill.
export function RateFields({ values, onRate, onRestore, onSscl }) {
  const tariff = findTariff(values.tariff);
  const edited = tariff && !ratesMatchTariff(values);
  return (
    <>
      <p className="fieldset-note" aria-live="polite">
        {!tariff && 'Type the rates printed on the bill.'}
        {tariff && !edited && `${tariff.id} rates in force from ${tariff.effective}. Change any that differ on the bill.`}
        {edited && (
          <>
            Changed from the {tariff.id} tariff.{' '}
            <button type="button" className="link-button" onClick={onRestore}>
              Use the {tariff.id} rates
            </button>
          </>
        )}
      </p>
      <div className="rate-grid">
        {RATE_FIELDS.map((f) => (
          <RateInput key={f.key} {...f} value={values.rates[f.key]} onChange={onRate(f.key)} />
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={values.sscl} onChange={(e) => onSscl(e.target.checked)} />
        <span>
          Add SSC Levy (2.5%)
          <small>Included on CEB/EDL and LECO bills</small>
        </span>
      </label>
    </>
  );
}

function Tick() {
  return (
    <svg className="check-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

// Optional: the total from the bill, to confirm everything was typed correctly.
export function BillCheck({ value, onChange, results: r }) {
  const diff = r.billDifference;
  let status = null;
  if (diff != null && Math.abs(diff) < 1) {
    status = (
      <p className="bill-check is-match">
        <Tick />
        Matches the bill: {rsExact(r.today.total)}
      </p>
    );
  } else if (diff != null) {
    status = (
      <div className="bill-check is-off">
        <p>
          The calculator gets {rsExact(r.today.total)}, which is {rsExact(Math.abs(diff))} {diff > 0 ? 'more' : 'less'} than
          the bill.
        </p>
        <p className="bill-check-help">
          Check the readings and rates against the bill. If the bill lists two consumption periods, the tariff changed during
          the month; this calculator prices the whole month at one set of rates.
        </p>
      </div>
    );
  }
  return (
    <NumberField
      label="Total on the bill"
      optional
      prefix="Rs."
      decimals={2}
      value={value}
      onChange={onChange}
      hint="To check what you typed: “Charge for this month” on CEB/EDL bills, “Total Amount with Tax” on LECO bills."
    >
      <div aria-live="polite">{status}</div>
    </NumberField>
  );
}
