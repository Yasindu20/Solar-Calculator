import { company } from '../config/company.js';
import { logoUrl } from '../lib/brandAssets.js';

// The sun on its path above the horizon. Used when no logo file has been added.
export function SunMark({ size = 32, ground = 'var(--c-paper)', line = 'var(--c-sapphire900)' }) {
  // Same geometry as the PDF mark, in a 100-unit box.
  const r = 42;
  const cx = 50;
  const base = 78;
  const a = (124 * Math.PI) / 180;
  const sx = cx + r * Math.cos(a);
  const sy = base - r * Math.sin(a);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d={`M ${cx - r} ${base} A ${r} ${r} 0 0 1 ${cx + r} ${base}`} fill="none" stroke={line} strokeWidth="6" strokeLinecap="round" />
      <line x1="2" y1={base} x2="98" y2={base} stroke={line} strokeWidth="6" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r="20" fill={ground} />
      <circle cx={sx} cy={sy} r="15" fill="var(--c-thambili500)" />
    </svg>
  );
}

export function BrandMark() {
  const showName = !logoUrl || !company.logoIncludesName;
  return (
    <a className="brand" href={company.website} target="_blank" rel="noreferrer">
      {logoUrl ? <img className="brand-logo" src={logoUrl} alt={showName ? '' : company.name} /> : <SunMark size={34} />}
      {showName && <span className="brand-name">{company.name}</span>}
    </a>
  );
}
