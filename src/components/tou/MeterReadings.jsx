import { useId, useRef } from 'react';
import { touPeriods } from '../../config/tariffs.js';
import { REGISTERS } from '../../lib/touCalc.js';
import { qty, units } from '../../lib/format.js';
import { NumberInput } from '../NumberField.jsx';

// Rows in the order and wording of the bill.
const ROWS = {
  day: { label: touPeriods.day.label, sub: touPeriods.day.window },
  peak: { label: touPeriods.peak.label, sub: touPeriods.peak.window },
  offPeak: { label: touPeriods.offPeak.label, sub: touPeriods.offPeak.window },
  export: { label: 'Export', sub: 'Only if solar is already installed' },
};

const ENTRY_OPTIONS = [
  { value: 'readings', label: 'Meter readings' },
  { value: 'units', label: 'Units only' },
];

// "Meter readings" or "Units only" — both are printed on every time-of-use bill.
export function EntrySwitch({ value, onChange }) {
  const name = useId();
  return (
    <div className="switch" role="radiogroup" aria-label="Enter the bill as">
      {ENTRY_OPTIONS.map((o) => (
        <label key={o.value} className={`switch-option${value === o.value ? ' is-on' : ''}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function MeterCell({ slot, label, ariaLabel, value, onChange, describedBy, invalid, suffix }) {
  const ref = useRef(null);
  return (
    <div className={`meter-cell meter-${slot}`}>
      <span className="meter-cell-label" aria-hidden="true">
        {label}
      </span>
      <div className={`control control-compact${invalid ? ' is-invalid' : ''}`} onClick={() => ref.current?.focus()}>
        <NumberInput
          inputRef={ref}
          value={value}
          onChange={onChange}
          decimals="auto"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
    </div>
  );
}

// The meter table: previous and current readings give the units automatically.
export function MeterTable({ values, results, onReading, onUnits }) {
  const base = useId();
  const readings = values.entry === 'readings';
  return (
    <div className={`meter${readings ? '' : ' meter-units-only'}`}>
      <div className="meter-head" aria-hidden="true">
        <span />
        {readings ? (
          <>
            <span>Previous</span>
            <span>Current</span>
            <span className="meter-head-units">Units</span>
          </>
        ) : (
          <span>Units this month</span>
        )}
      </div>

      {REGISTERS.map((key) => {
        const row = ROWS[key];
        const res = results.registers[key];
        const reversed = res.status === 'reversed';
        const msgId = reversed ? `${base}-${key}-msg` : undefined;
        return (
          <div key={key} className={`meter-row${key === 'export' ? ' is-optional' : ''}`}>
            <div className="meter-name">
              <span className="meter-label">{row.label}</span>
              <span className="meter-sub">{row.sub}</span>
            </div>
            {readings ? (
              <>
                <MeterCell
                  slot="prev"
                  label="Previous"
                  ariaLabel={`${row.label}, previous reading`}
                  value={values.readings[key].prev}
                  onChange={onReading(key, 'prev')}
                  describedBy={msgId}
                  invalid={reversed}
                />
                <MeterCell
                  slot="curr"
                  label="Current"
                  ariaLabel={`${row.label}, current reading`}
                  value={values.readings[key].curr}
                  onChange={onReading(key, 'curr')}
                  describedBy={msgId}
                  invalid={reversed}
                />
                <div className="meter-result">
                  <span className="meter-cell-label" aria-hidden="true">
                    Units
                  </span>
                  <output aria-label={`${row.label} units`}>{res.status === 'ok' ? qty(res.units) : '—'}</output>
                </div>
              </>
            ) : (
              <MeterCell
                slot="units"
                label="Units"
                ariaLabel={`${row.label} units`}
                value={values.units[key]}
                onChange={onUnits(key)}
                suffix="units"
              />
            )}
            {reversed && (
              <p className="meter-msg" id={msgId}>
                The current reading is lower than the previous one. Check both.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The balances worked out from the table: Day units after any export, night-time units, the total.
export function MeterSummary({ results: r }) {
  const hasExport = r.exported > 0;
  return (
    <dl className="tally" aria-live="polite">
      <div>
        <dt>
          {hasExport ? 'Day units billed' : 'Day units'}
          <small>
            {hasExport
              ? `${qty(r.dayImport)} imported − ${qty(r.exported)} exported`
              : 'Used in daylight, so solar can replace them'}
          </small>
        </dt>
        <dd>{units(r.dayUnits)}</dd>
      </div>
      <div>
        <dt>
          Night-time units
          <small>
            Peak {qty(r.peakUnits)} + Off-peak {qty(r.offPeakUnits)}, used after dark
          </small>
        </dt>
        <dd>{units(r.nightUnits)}</dd>
      </div>
      {r.existingSurplus > 0 && (
        <div>
          <dt>
            Export beyond Day use
            <small>Paid separately under the existing solar agreement</small>
          </dt>
          <dd>{units(r.existingSurplus)}</dd>
        </div>
      )}
      <div className="tally-total">
        <dt>Total units this month</dt>
        <dd>{units(r.totalUnits)}</dd>
      </div>
    </dl>
  );
}
