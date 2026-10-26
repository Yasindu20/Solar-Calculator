// Axis scale for the cumulative cash chart, shared by the website and the PDF.

export function niceStep(range, targetTicks) {
  const raw = range / Math.max(1, targetTicks);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

// The top snaps to a tick; the bottom gets only enough room for the label under the first column.
export function cashScale(values, { targetTicks = 5, bottomPad = 0.11 } = {}) {
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const step = niceStep(Math.max(1, maxV - minV), targetTicks);
  let hi = maxV > 0 ? Math.ceil(maxV / step) * step : 0;
  const lo = minV < 0 ? minV - (hi - minV) * bottomPad : 0;
  if (hi === 0 && minV < 0) hi = (hi - lo) * 0.08; // all below zero: a sliver above the line
  if (hi - lo < 1) hi = lo + 1;
  const ticks = [];
  for (let k = Math.ceil(lo / step); k * step <= hi + step / 2; k++) ticks.push(k === 0 ? 0 : k * step);
  return { lo, hi, step, ticks };
}
