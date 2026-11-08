import { useRef } from 'react';
import { touPeriods } from '../../config/tariffs.js';
import { qty, units } from '../../lib/format.js';
import { NumberInput } from '../NumberField.jsx';

// Every charge on the bill in one table, in the bill's order: the rate, then the units.
// rate: key in values.rates · units: key in values.units ('maxDemand' is its own field)
const ROWS = [
  { key: 'day', label: touPeriods.day.label, sub: touPeriods.day.window, rate: 'day', units: 'day', unit: 'units', decimals: 2 },
  { key: 'peak', label: touPeriods.peak.label, sub: touPeriods.peak.window, rate: 'peak', units: 'peak', unit: 'units', decimals: 2 },
  { key: 'offPeak', label: touPeriods.offPeak.label, sub: touPeriods.offPeak.window, rate: 'offPeak', units: 'offPeak', unit: 'units', decimals: 2 },
  { key: 'demand', label: 'Max demand', sub: 'This month’s kVA', rate: 'demand', units: 'maxDemand', unit: 'kVA', decimals: 'auto' },
  { key: 'fixed', label: 'Fixed charge', sub: 'Per month', rate: 'fixed', decimals: 'auto' },
  { key: 'export', label: 'Export', sub: 'Only if solar is already installed', units: 'export', unit: 'units' },
];

function Cell({ prefix, suffix, ariaLabel, value, onChange, decimals }) {
  const ref = useRef(null);
  return (
    <div className="control control-compact" onClick={() => ref.current?.focus()}>
      {prefix && <span className="affix">{prefix}</span>}
      <NumberInput inputRef={ref} value={value} onChange={onChange} decimals={decimals} aria-label={ariaLabel} />
      {suffix && <span className="affix">{suffix}</span>}
    </div>
  );
}

export function ChargesTable({ values, onRate, onUnits, onMaxDemand }) {
  return (
    <div className="charges" role="group" aria-label="Rates and units from the bill">
      <div className="charges-head" aria-hidden="true">
        <span />
        <span>Rate</span>
        <span>Units this month</span>
      </div>

      {ROWS.map((row) => {
        const isDemand = row.units === 'maxDemand';
        return (
          <div key={row.key} className="charges-row">
            <div className="charges-name">
              <span className="charges-label">{row.label}</span>
              <span className="charges-sub">{row.sub}</span>
            </div>
            {row.rate ? (
              <Cell
                prefix="Rs."
                ariaLabel={row.key === 'fixed' ? 'Fixed charge' : `${row.label} rate`}
                value={values.rates[row.rate]}
                onChange={onRate(row.rate)}
                decimals={row.decimals}
              />
            ) : (
              <span />
            )}
            {row.units ? (
              <Cell
                suffix={row.unit}
                ariaLabel={isDemand ? 'Max demand kVA' : `${row.label} units`}
                value={isDemand ? values.maxDemand : values.units[row.units]}
                onChange={isDemand ? onMaxDemand : onUnits(row.units)}
                decimals="auto"
              />
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}

// The balances worked out from the table: Day units after any export, night-time units, the total.
export function UnitsSummary({ results: r }) {
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
