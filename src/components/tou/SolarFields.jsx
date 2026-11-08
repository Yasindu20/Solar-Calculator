import { useId } from 'react';
import { touSettings } from '../../config/tariffs.js';
import { formatTyped, qty, rs, rsRate } from '../../lib/format.js';
import { NumberField } from '../NumberField.jsx';

// A system size people would actually quote: whole kWp, or one decimal for small systems.
export function roundSize(kwp) {
  return kwp >= 20 ? Math.round(kwp) : Math.round(kwp * 10) / 10;
}

const SCHEMES = [
  { value: 'onsite', title: 'Cut the bill', text: 'Solar units replace Day units on the bill. Any surplus is paid.' },
  { value: 'netplus', title: 'Sell it all (Net Plus)', text: 'Every unit is sold to the grid. The bill stays the same.' },
];

function SchemeChoice({ value, onChange }) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div className="field">
      <p className="field-label" id={labelId}>
        How the solar is used
      </p>
      <div className="choice" role="radiogroup" aria-labelledby={labelId}>
        {SCHEMES.map((s) => (
          <label key={s.value} className={`choice-card${value === s.value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={s.value} checked={value === s.value} onChange={() => onChange(s.value)} />
            <span className="choice-body">
              <strong>{s.title}</strong>
              <small>{s.text}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg className="advice-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </svg>
  );
}

// What the chosen size does to the bill, worked out as the figures are typed.
function SizeAdvice({ r, onUseSize }) {
  const suggested = roundSize(r.suggestedKwp);
  const useButton = (text) => (
    <button type="button" className="link-button" onClick={() => onUseSize(suggested)}>
      {text}
    </button>
  );

  let body;
  if (r.netPlus) {
    body = (
      <p>
        All {qty(r.generation)} units are sold at {rsRate(r.exportRate)}, earning {rs(r.solarIncome)} a month. The bill stays at{' '}
        {rs(r.today.total)}.
      </p>
    );
  } else if (r.dayUnits <= 0) {
    body = <p>There are no Day units left on the bill to replace, so every solar unit would be sold as surplus.</p>;
  } else if (r.generation <= 0) {
    body = (
      <p>
        Add a system size to see what it takes off the bill. About {suggested} kWp would match the {qty(r.dayUnits)} Day units.{' '}
        {useButton(`Use ${suggested} kWp`)}
      </p>
    );
  } else if (Math.abs(r.generation - r.dayUnits) < touSettings.unitsPerKwpPerMonth / 2) {
    body = (
      <p>
        This size covers all {qty(r.dayUnits)} Day units. The {qty(r.nightUnits)} Peak and Off-peak units still come from the
        grid.
      </p>
    );
  } else if (r.generation < r.dayUnits) {
    const share = Math.round((r.solarToDay / r.dayUnits) * 100);
    body = (
      <p>
        Solar covers {qty(r.solarToDay)} of the {qty(r.dayUnits)} Day units ({share}%). Still from the grid: {qty(r.dayBalance)}{' '}
        Day units and {qty(r.nightUnits)} night-time units. About {suggested} kWp would cover every Day unit.{' '}
        {useButton(`Use ${suggested} kWp`)}
      </p>
    );
  } else {
    body = (
      <p>
        Solar makes {qty(r.soldUnits)} units more than the Day use. They are sold at {rsRate(r.exportRate)} each instead of
        replacing Day units at {rsRate(r.rates.day)}. {useButton(`Use ${suggested} kWp`)} to match the Day use.
      </p>
    );
  }

  return (
    <div className="advice" aria-live="polite">
      <SunIcon />
      {body}
    </div>
  );
}

export function SolarFields({ values, results: r, set, onSize }) {
  const upk = touSettings.unitsPerKwpPerMonth;
  return (
    <>
      <div className="field-pair field-pair-even">
        <NumberField label="System size" suffix="kWp" decimals="auto" value={values.systemSize} onChange={onSize} />
        <NumberField
          label="Generation per month"
          suffix="units"
          value={values.generation}
          onChange={set('generation')}
          hint={`Set at ${upk} units per kWp. Change it for a site estimate.`}
        />
      </div>

      <SizeAdvice r={r} onUseSize={(kwp) => onSize(formatTyped(kwp, 'auto'))} />

      <SchemeChoice value={values.scheme} onChange={set('scheme')} />

      <NumberField
        label={r.netPlus ? 'Payment per unit sold' : 'Payment per surplus unit'}
        prefix="Rs."
        decimals={2}
        value={values.exportRate}
        onChange={set('exportRate')}
        hint={
          r.netPlus
            ? 'The feed-in rate in the Net Plus agreement'
            : 'For units beyond the Day use. Enter 0 if surplus isn’t paid.'
        }
      />
      <NumberField label="System cost" prefix="Rs." value={values.investment} onChange={set('investment')} hint="Total installed price" />
    </>
  );
}
