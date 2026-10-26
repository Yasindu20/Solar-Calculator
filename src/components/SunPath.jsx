import { useId } from 'react';
import { useAnimatedValue } from '../lib/hooks.js';

const W = 360;
const H = 206;
const CX = 180;
const BASE = 170;
const R = 140;

function point(deg, r = R) {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), BASE - r * Math.sin(a)];
}

function arc(fromDeg, toDeg, r = R) {
  const [x0, y0] = point(fromDeg, r);
  const [x1, y1] = point(toDeg, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// The sun's path across the sky stands for the 20-year outlook.
// The sun sits where the system has paid for itself; the bright part of the path is time spent ahead.
export function SunPath({ paybackYears, years }) {
  const clipId = useId();
  const reached = paybackYears != null && paybackYears <= years;
  const target = reached ? Math.max(0, paybackYears / years) : 1;
  const t = useAnimatedValue(target, { from: 0, duration: 1100 });
  const sunDeg = 180 - 180 * t;
  const [sx, sy] = point(sunDeg);

  const ticks = [];
  for (let y = 5; y < years; y += 5) ticks.push(y);

  return (
    <svg className="sunpath" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={W} height={BASE} />
        </clipPath>
      </defs>

      {[1, 2].map((i) => (
        <path key={i} d={arc(180, 0, R + i * 18)} className="sunpath-echo" style={{ opacity: 0.16 - i * 0.05 }} />
      ))}

      <line x1="8" x2={W - 8} y1={BASE} y2={BASE} className="sunpath-horizon" />

      <path d={arc(180, sunDeg)} className="sunpath-track" />
      {reached && sunDeg > 0.5 && <path d={arc(sunDeg, 0)} className="sunpath-ahead" />}

      {ticks.map((y) => {
        const deg = 180 - (180 * y) / years;
        const [tx, ty] = point(deg, R + 13);
        const [lx, ly] = point(deg, R + 26);
        return (
          <g key={y}>
            <circle cx={tx} cy={ty} r="1.6" className="sunpath-tick" />
            <text x={lx} y={ly + 4} textAnchor="middle" className="sunpath-label">
              {y}
            </text>
          </g>
        );
      })}

      <text x={CX - R} y={H - 4} textAnchor="middle" className="sunpath-label">
        Today
      </text>
      <text x={CX + R} y={H - 4} textAnchor="middle" className="sunpath-label">
        {years} years
      </text>

      {reached && (
        <g clipPath={`url(#${clipId})`}>
          <circle cx={sx} cy={sy} r="34" className="sun-glow" style={{ opacity: 0.1 }} />
          <circle cx={sx} cy={sy} r="22" className="sun-glow" style={{ opacity: 0.22 }} />
          <circle cx={sx} cy={sy} r="12.5" className="sun-core" />
        </g>
      )}
    </svg>
  );
}
