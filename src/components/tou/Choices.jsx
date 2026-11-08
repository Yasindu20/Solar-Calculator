import { useId } from 'react';

// Radio buttons drawn as cards: a title and one line on what the choice does.
export function ChoiceCards({ label, options, value, onChange, columns = 2 }) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div className="field">
      <p className="field-label" id={labelId}>
        {label}
      </p>
      <div className={`choice${columns === 2 ? '' : ' choice-1'}`} role="radiogroup" aria-labelledby={labelId}>
        {options.map((o) => (
          <label key={o.value} className={`choice-card${value === o.value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="choice-body">
              <strong>
                {o.title}
                {o.badge && <span className="choice-badge">{o.badge}</span>}
              </strong>
              <small>{o.text}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// A short row of mutually exclusive options.
export function Segmented({ label, options, value, onChange }) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div className="field">
      <p className="field-label" id={labelId}>
        {label}
      </p>
      <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
        {options.map((o) => (
          <label key={o.value} className={`segmented-option${value === o.value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// An on/off switch with a label and an optional line under it.
export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
