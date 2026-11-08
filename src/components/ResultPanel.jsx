import { paybackParts, paybackShort } from '../lib/format.js';
import { SunPath } from './SunPath.jsx';

// The dark panel beside the form: payback headline, sun path, key figures and the PDF button.
// `children` sits between the sun path and the figures (the time-of-use bill comparison).
// `empty` ({ headline, note }) replaces the payback while there's nothing to work from yet.
export function ResultPanel({ results: r, figures, noBenefitNote, empty, children, onDownload, busy, failed, panelRef }) {
  const parts = empty ? null : paybackParts(r.payback);
  const within = r.paybackYears != null && r.paybackYears <= r.years;
  const noCost = !r.hasCost && !empty;

  let lead = 'This system pays for itself in';
  let headline = null;
  if (empty) {
    lead = 'Payback period';
    headline = empty.headline;
  } else if (noCost) {
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

      <SunPath paybackYears={empty ? null : r.paybackYears} years={r.years} />

      {parts && !within && <p className="result-note">That’s longer than the {r.years}-year outlook.</p>}
      {empty && <p className="result-note">{empty.note}</p>}
      {!parts && !noCost && !empty && <p className="result-note">{noBenefitNote}</p>}
      {noCost && <p className="result-note">Enter the total installed price to see when the system pays for itself.</p>}

      {children}

      <dl className="result-figures">
        {figures.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
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

// Payback and the download button, pinned to the bottom of small screens while the panel is out of view.
export function MobileBar({ results, visible, onDownload, busy, emptyText }) {
  const ready = results.hasCost && !emptyText;
  return (
    <div className={`mobile-bar${visible ? ' is-visible' : ''}`} inert={!visible}>
      <div className="mobile-bar-text">
        <span>{ready ? 'Pays for itself in' : 'Payback period'}</span>
        <strong>{ready ? paybackShort(results.payback) : emptyText || 'Add the system cost'}</strong>
      </div>
      <button type="button" className="download" onClick={onDownload} disabled={busy}>
        {busy ? 'Preparing…' : 'Download PDF'}
      </button>
    </div>
  );
}
