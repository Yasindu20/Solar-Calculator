import { useId, useRef } from 'react';
import { formatTyped } from '../lib/format.js';

// Keeps digits, commas and a single decimal point.
function sanitize(text, allowDecimals) {
  let cleaned = text.replace(allowDecimals ? /[^0-9.,]/g : /[^0-9,]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
}

// A bare number input: cleans what is typed and adds thousands separators when it loses focus.
export function NumberInput({ value, onChange, decimals = 0, inputRef, ...rest }) {
  return (
    <input
      ref={inputRef}
      inputMode="decimal"
      autoComplete="off"
      spellCheck="false"
      value={value}
      onChange={(e) => onChange(sanitize(e.target.value, decimals !== 0))}
      onBlur={() => onChange(formatTyped(value, decimals))}
      {...rest}
    />
  );
}

export function NumberField({ label, hint, prefix, suffix, value, onChange, decimals = 0, placeholder, optional, children }) {
  const id = useId();
  const inputRef = useRef(null);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      <div className="control" onClick={() => inputRef.current?.focus()}>
        {prefix && <span className="affix">{prefix}</span>}
        <NumberInput
          inputRef={inputRef}
          id={id}
          value={value}
          onChange={onChange}
          decimals={decimals}
          placeholder={placeholder}
          aria-describedby={hintId}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, optional }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      <div className="control">
        <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
