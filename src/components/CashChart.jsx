import { useMemo, useState } from 'react';
import { useElementWidth } from '../lib/hooks.js';
import { cashScale } from '../lib/chart.js';
import { rs, rsCompact, paybackLong, paybackShort } from '../lib/format.js';

const HEIGHT = 300;
const PAD = { top: 18, right: 6, bottom: 34, left: 62 };

let measureCtx;
function textWidth(text, font) {
  if (typeof document === 'undefined') return text.length * 7;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

// Rounded data end, square base on the zero line.
function columnPath(x, base, w, h, radius = 4) {
  const H = Math.abs(h);
  const r = Math.min(radius, w / 2, H);
  if (h >= 0) {
    const top = base - H;
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
  }
  const bottom = base + H;
  return `M${x},${base} V${bottom - r} Q${x},${bottom} ${x + r},${bottom} H${x + w - r} Q${x + w},${bottom} ${x + w},${bottom - r} V${base} Z`;
}

function yearLabel(i) {
  return i === 0 ? 'Today, after paying for the system' : `End of year ${i}`;
}

export function CashChart({ results }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null);
  const values = results.cumulative;
  const n = values.length;

  const geo = useMemo(() => {
    if (!width) return null;
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const { lo, hi, ticks } = cashScale(values, { bottomPad: 0.12 });
    const y = (v) => PAD.top + ((hi - v) / (hi - lo)) * plotH;
    const slot = plotW / n;
    const colW = Math.min(24, slot * 0.6);
    const cx = (i) => PAD.left + slot * i + slot / 2;
    return { plotW, plotH, ticks, y, slot, colW, cx, zero: y(0) };
  }, [width, values, n]);

  const payback = results.paybackYears;
  const showPayback = payback != null && payback > 0 && payback <= results.years;

  const first = values[0];
  const last = values[n - 1];

  // Payback marker label: the longest wording that clears the columns and the end label.
  let marker = null;
  if (geo && showPayback) {
    const font = '600 13px Barlow, sans-serif';
    const px = PAD.left + geo.slot * payback + geo.slot / 2;
    const endW = last > 0 ? textWidth(rs(last), font) : 0;
    const endX = geo.cx(n - 1) + geo.colW / 2;
    const endBox = last > 0 ? { x0: endX - endW, x1: endX, y0: geo.y(last) - 22, y1: geo.y(last) - 4 } : null;
    const candidates = [
      `Paid back after ${paybackLong(results.payback)}`,
      `Paid back in ${paybackShort(results.payback)}`,
      'Paid back',
    ];
    for (const [k, label] of candidates.entries()) {
      const lw = textWidth(label, font);
      const flip = px + 8 + lw > width - PAD.right;
      const x0 = flip ? px - 8 - lw : px + 8;
      let tallest = 0;
      values.forEach((v, i) => {
        const c = geo.cx(i);
        if (v > 0 && c + geo.colW / 2 > x0 - 4 && c - geo.colW / 2 < x0 + lw + 4) {
          tallest = Math.max(tallest, geo.zero - geo.y(v));
        }
      });
      const wanted = geo.zero - Math.max(46, tallest + 18);
      const ly = Math.max(PAD.top + 12, wanted);
      const hitsEnd = endBox && x0 < endBox.x1 && x0 + lw > endBox.x0 && ly - 14 < endBox.y1 && ly + 4 > endBox.y0;
      if ((wanted >= PAD.top + 12 && !hitsEnd) || k === candidates.length - 1) {
        marker = { px, ly, label, flip };
        break;
      }
    }
  }

  const tip = active != null && geo ? {
    i: active,
    v: values[active],
    x: geo.cx(active),
    y: values[active] >= 0 ? geo.y(values[active]) : geo.zero,
  } : null;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((cur) => {
        const start = cur ?? 0;
        return Math.max(0, Math.min(n - 1, start + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  return (
    <div className="chart" ref={ref}>
      {geo && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Cumulative position over ${results.years} years, from ${rs(first)} today to ${rs(last)} after ${results.years} years. Use the arrow keys to read each year.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((cur) => cur ?? 0)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {geo.ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(v)} y2={geo.y(v)} className={v === 0 ? 'axis-zero' : 'grid'} />
              <text x={PAD.left - 10} y={geo.y(v) + 4} textAnchor="end" className="tick">
                {v === 0 ? '0' : `Rs. ${rsCompact(v)}`}
              </text>
            </g>
          ))}

          {values.map((v, i) => {
            const h = geo.zero - geo.y(v);
            const x = geo.cx(i) - geo.colW / 2;
            return (
              <g key={i}>
                {Math.abs(h) > 0.5 && (
                  <path
                    d={columnPath(x, geo.zero, geo.colW, h)}
                    className={`${v >= 0 ? 'col-ahead' : 'col-behind'}${active === i ? ' is-active' : ''}`}
                  />
                )}
                <rect
                  x={PAD.left + geo.slot * i}
                  y={PAD.top}
                  width={geo.slot}
                  height={geo.plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              </g>
            );
          })}

          {values.map((_, i) =>
            i % 5 === 0 ? (
              <text key={i} x={geo.cx(i)} y={HEIGHT - 10} textAnchor="middle" className="tick">
                {i === 0 ? 'Now' : `${i} yrs`}
              </text>
            ) : null,
          )}

          {first < 0 && (
            <text x={geo.cx(0) - geo.colW / 2} y={geo.y(first) + 17} className="direct-label">
              {rs(first)}
            </text>
          )}
          {last > 0 && (
            <text x={geo.cx(n - 1) + geo.colW / 2} y={geo.y(last) - 8} textAnchor="end" className="direct-label">
              {rs(last)}
            </text>
          )}

          {marker && (
            <g className="payback-marker" pointerEvents="none">
              <line x1={marker.px} x2={marker.px} y1={geo.zero - 8} y2={marker.ly + 5} />
              <text x={marker.flip ? marker.px - 8 : marker.px + 8} y={marker.ly} textAnchor={marker.flip ? 'end' : 'start'}>
                {marker.label}
              </text>
              <circle cx={marker.px} cy={geo.zero} r="8" className="sun-ring" />
              <circle cx={marker.px} cy={geo.zero} r="6" className="sun-dot" />
            </g>
          )}
        </svg>
      )}

      {tip && (
        <div
          className="chart-tip"
          style={{
            left: Math.min(Math.max(tip.x, 90), width - 90),
            top: tip.y - 12,
          }}
          role="status"
        >
          <strong>{tip.v >= 0 ? `${rs(tip.v)} ahead` : `${rs(-tip.v)} still to recover`}</strong>
          <span>{yearLabel(tip.i)}</span>
        </div>
      )}
    </div>
  );
}

export function CashTable({ results }) {
  return (
    <table className="year-table">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Benefit to date</th>
          <th scope="col">Position after system cost</th>
        </tr>
      </thead>
      <tbody>
        {results.cumulative.map((v, i) => (
          <tr key={i}>
            <th scope="row">{i === 0 ? 'Now' : i}</th>
            <td>{rs(results.yearIncome * i)}</td>
            <td className={v >= 0 ? 'is-ahead' : undefined}>{rs(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
