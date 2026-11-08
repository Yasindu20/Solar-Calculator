// Draws the one-page A4 report onto a jsPDF document (units: mm).
// Pure drawing code: fonts, the logo and jsPDF itself are passed in, so the same
// function works in the browser and in Node.

import { colors as C } from '../../config/brand.js';
import { company, assumptions } from '../../config/company.js';
import { touPeriods } from '../../config/tariffs.js';
import {
  rs,
  rsRate,
  num,
  qty,
  units,
  percent,
  rsCompact,
  paybackParts,
  paybackLong,
  paybackShort,
  tonnes,
  formatTyped,
} from '../format.js';
import { cashScale } from '../chart.js';
import { benefitNoun } from '../touCalc.js';
import { batteryStory } from '../batteryStory.js';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // side margin
const CONTENT_W = PAGE_W - M * 2;

const HEADER_H = 84;
const TILE_Y = 73;
const TILE_H = 29;

// ---------------------------------------------------------------- helpers

function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function pen(doc, fonts) {
  const api = {
    fill(hex) { doc.setFillColor(...rgb(hex)); return api; },
    stroke(hex) { doc.setDrawColor(...rgb(hex)); return api; },
    color(hex) { doc.setTextColor(...rgb(hex)); return api; },
    width(w) { doc.setLineWidth(w); return api; },
    font(kind, size) {
      const [name, style] = fonts[kind];
      doc.setFont(name, style);
      doc.setFontSize(size);
      return api;
    },
    alpha(a) {
      doc.setGState(new doc.GState({ opacity: a, 'stroke-opacity': a }));
      return api;
    },
  };
  return api;
}

// Point on a circle; 0° = right, 90° = straight up.
function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// Path operations for a circular arc, built from cubic Béziers (≤ 90° each).
function arcOps(cx, cy, r, fromDeg, toDeg) {
  const total = toDeg - fromDeg;
  const n = Math.max(1, Math.ceil(Math.abs(total) / 90));
  const step = total / n;
  const toPage = ([x, y]) => [cx + r * x, cy - r * y];
  const ops = [{ op: 'm', c: polar(cx, cy, r, fromDeg) }];
  for (let i = 0; i < n; i++) {
    const a1 = ((fromDeg + i * step) * Math.PI) / 180;
    const a2 = ((fromDeg + (i + 1) * step) * Math.PI) / 180;
    const k = (4 / 3) * Math.tan((a2 - a1) / 4);
    const p0 = [Math.cos(a1), Math.sin(a1)];
    const p3 = [Math.cos(a2), Math.sin(a2)];
    const p1 = [p0[0] - k * p0[1], p0[1] + k * p0[0]];
    const p2 = [p3[0] + k * p3[1], p3[1] - k * p3[0]];
    ops.push({ op: 'c', c: [...toPage(p1), ...toPage(p2), ...toPage(p3)] });
  }
  return ops;
}

function strokeArc(doc, cx, cy, r, fromDeg, toDeg) {
  if (Math.abs(toDeg - fromDeg) < 0.01) return;
  doc.path(arcOps(cx, cy, r, fromDeg, toDeg));
  doc.stroke();
}

// A column with a rounded data end and a square base on the zero line.
function columnOps(x, base, w, h, radius) {
  const H = Math.abs(h);
  const r = Math.min(radius, w / 2, H);
  const k = 0.4477 * r; // quarter-circle Bézier offset
  if (h >= 0) {
    const top = base - H;
    return [
      { op: 'm', c: [x, base] },
      { op: 'l', c: [x, top + r] },
      { op: 'c', c: [x, top + k, x + k, top, x + r, top] },
      { op: 'l', c: [x + w - r, top] },
      { op: 'c', c: [x + w - k, top, x + w, top + k, x + w, top + r] },
      { op: 'l', c: [x + w, base] },
      { op: 'h', c: [] },
    ];
  }
  const bottom = base + H;
  return [
    { op: 'm', c: [x, base] },
    { op: 'l', c: [x, bottom - r] },
    { op: 'c', c: [x, bottom - k, x + k, bottom, x + r, bottom] },
    { op: 'l', c: [x + w - r, bottom] },
    { op: 'c', c: [x + w - k, bottom, x + w, bottom - k, x + w, bottom - r] },
    { op: 'l', c: [x + w, base] },
    { op: 'h', c: [] },
  ];
}

// Draws text pieces in different fonts on one baseline; returns the end x.
function runs(doc, p, pieces, x, y, align = 'left') {
  const measured = pieces.map((piece) => {
    p.font(piece.font, piece.size);
    return { ...piece, w: doc.getTextWidth(piece.text) };
  });
  const total = measured.reduce((sum, piece) => sum + piece.w + (piece.gap ?? 0), 0);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  for (const piece of measured) {
    p.font(piece.font, piece.size).color(piece.color);
    doc.text(piece.text, cx, y + (piece.dy ?? 0));
    cx += piece.w + (piece.gap ?? 0);
  }
  return cx;
}

// Largest font size (≤ size) at which text fits in maxWidth.
function fitSize(doc, p, kind, text, size, maxWidth, minSize = 6) {
  let s = size;
  p.font(kind, s);
  while (s > minSize && doc.getTextWidth(text) > maxWidth) {
    s -= 0.5;
    p.font(kind, s);
  }
  return s;
}

function formatDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function reportNumber(now) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `${company.reportPrefix}-${stamp}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function reportFileName(details, now) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const who = (details.customerName || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${company.reportPrefix}-Solar-Report${who ? `-${who}` : ''}-${date}.pdf`;
}

// ------------------------------------------------------------ brand mark

// Sun on its path above the horizon — the fallback mark when no logo file is added.
function drawEmblem(doc, p, x, y, size, ground = C.sapphire900) {
  const cx = x + size / 2;
  const base = y + size * 0.78;
  const r = size * 0.42;
  doc.setLineCap('round');
  p.stroke(C.paper).width(size * 0.06);
  strokeArc(doc, cx, base, r, 180, 0);
  doc.line(x, base, x + size, base);
  const [sx, sy] = polar(cx, base, r, 124);
  p.fill(ground);
  doc.circle(sx, sy, size * 0.2, 'F');
  p.fill(C.thambili500);
  doc.circle(sx, sy, size * 0.15, 'F');
}

// ---------------------------------------------------------------- report

// kind: 'standard' for a bill with one units total, 'tou' for a Day / Peak / Off-peak bill.
export function drawReport(doc, { kind = 'standard', results: r, details = {}, now = new Date(), fonts, logo }) {
  const p = pen(doc, fonts);
  const tou = kind === 'tou';

  doc.setProperties({
    title: tou ? 'Solar investment report (time-of-use bill)' : 'Solar investment report',
    subject: 'Solar power financial estimate',
    author: company.legalName,
    creator: `${company.name} solar calculator`,
  });
  doc.setLineJoin('round');

  drawHeader(doc, p, r, details, now, logo, tou);
  drawTiles(doc, p, r, tou);

  let y = TILE_Y + TILE_H + 13;
  if (tou) {
    // Page 1: the bill, the saving and how the battery runs
    y = drawTouBill(doc, p, r, y);
    y = drawTouSavings(doc, p, r, y + 9);
    if (r.battery.on) y = drawBatteryDay(doc, p, r, y + 9);
    drawUnitsBars(doc, p, r, y + 9);
    drawFooter(doc, p);

    // Page 2: the investment
    doc.addPage();
    drawPageBand(doc, p, now, logo, 'Solar investment report · investment and returns');
    y = drawReturnsFacts(doc, p, r, 33);
    y = drawCashChart(doc, p, r, y + 9, 42);
    y = drawMilestones(doc, p, r, y + 4);
    y = drawYearTable(doc, p, r, y + 10);
    drawAssumptions(doc, p, r, details, y + 8);
  } else {
    y = drawMonthly(doc, p, r, y);
    y = drawCashChart(doc, p, r, y + 10);
    y = drawTotals(doc, p, r, y + 8);
    drawNotes(doc, p, r, y + 7);
  }
  drawFooter(doc, p);

  return doc;
}

// ---------------------------------------------------------------- header

function drawHeader(doc, p, r, details, now, logo, tou) {
  p.fill(C.sapphire900);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

  // Sun path: 0 → 20 years across the sky, the sun sits where the system has paid for itself.
  const SX = 158;
  const SY = 61;
  const SR = 29;

  // Faint concentric paths behind it, clipped to the band.
  doc.saveGraphicsState();
  doc.rect(0, 0, PAGE_W, HEADER_H, null);
  doc.clip();
  doc.discardPath();
  p.stroke(C.sapphire300).width(0.22);
  for (let i = 1; i <= 6; i++) {
    p.alpha(Math.max(0.025, 0.13 - i * 0.018));
    strokeArc(doc, SX, SY, SR + i * 8.5, 180, 0);
  }
  doc.restoreGraphicsState();

  // Brand row: logo, then the company name
  const markY = 11;
  let nameX = M;
  if (logo) {
    const h = 14.5;
    const w = Math.min(48, h * logo.aspect);
    const top = markY + 6.6 - h / 2; // centred on the two lines of text beside it
    if (company.logoPanel) {
      p.fill(C.paper);
      doc.roundedRect(M - 2.5, top - 2.5, w + 5, h + 5, 2.2, 2.2, 'F');
    }
    doc.addImage(logo.dataUrl, 'PNG', M, top, w, h, 'brand-logo', 'SLOW');
    nameX = M + w + (company.logoPanel ? 7 : 4.5);
  } else {
    drawEmblem(doc, p, M, markY - 0.5, 11);
    nameX = M + 15;
  }
  if (!logo || !company.logoIncludesName) {
    p.font('display', 13).color(C.paper);
    doc.text(company.name, nameX, markY + 5.4);
    p.font('regular', 8).color(C.sapphire300);
    doc.text(company.websiteLabel.replace(/^www\./, ''), nameX, markY + 10.2);
  }

  // Report reference
  p.font('regular', 7.5).color(C.sapphire300);
  doc.text('Report no.', PAGE_W - M, markY + 1.6, { align: 'right' });
  p.font('medium', 8.5).color(C.paper);
  doc.text(reportNumber(now), PAGE_W - M, markY + 5.8, { align: 'right' });
  p.font('regular', 7.5).color(C.sapphire300);
  doc.text(formatDate(now), PAGE_W - M, markY + 10.2, { align: 'right' });

  // Title
  p.font('display', 27).color(C.paper);
  doc.text('Solar investment', M, 40);
  doc.text('report', M, 50.5);

  const name = (details.customerName || '').trim();
  const location = (details.location || '').trim();
  const size = (details.systemSize || '').trim();
  p.font('regular', 9.5).color(C.sapphire300);
  if (name) {
    runs(doc, p, [
      { text: 'Prepared for ', font: 'regular', size: 9.5, color: C.sapphire300 },
      { text: name, font: 'semibold', size: 9.5, color: C.paper },
    ], M, 59.5);
  } else {
    doc.text(
      tou
        ? r.battery.on
          ? 'Savings and payback for solar and battery storage on a time-of-use bill'
          : 'Savings and payback for solar on a time-of-use electricity bill'
        : 'Savings, income and payback for your rooftop solar system',
      M,
      59.5,
    );
  }
  const facts = [];
  if (location) facts.push(location);
  if (size) facts.push(`${size.replace(/\s*kwp?$/i, '')} kWp ${tou ? 'solar' : 'system'}`);
  if (tou && r.battery.on) facts.push(`${qty(r.battery.capacity)} kWh battery`);
  if (tou && details.tariff) facts.push(`${details.tariff} tariff`);
  if (facts.length) {
    let fx = M;
    for (const fact of facts) {
      p.font('medium', 8);
      const w = doc.getTextWidth(fact) + 6;
      p.stroke(C.sapphire700).width(0.3);
      doc.roundedRect(fx, 62.6, w, 5.6, 2.8, 2.8, 'S');
      p.color(C.paper);
      doc.text(fact, fx + 3, 66.4);
      fx += w + 2.5;
    }
  }

  // Horizon
  p.alpha(0.35).stroke(C.sapphire300).width(0.3);
  doc.line(SX - SR - 7, SY, SX + SR + 7, SY);
  p.alpha(1);

  const years = r.years;
  const t = r.paybackYears == null ? 1 : Math.min(1, Math.max(0, r.paybackYears / years));
  const sunDeg = 180 - 180 * t;
  const reached = r.paybackYears != null && r.paybackYears <= years;

  doc.setLineCap('round');
  p.stroke(C.sapphire700).width(1.5);
  strokeArc(doc, SX, SY, SR, 180, sunDeg);
  if (reached) {
    p.stroke(C.thambili500).width(1.5);
    strokeArc(doc, SX, SY, SR, sunDeg, 0);
  }

  // Ticks every 5 years
  for (let yr = 5; yr < years; yr += 5) {
    const [tx, ty] = polar(SX, SY, SR + 2.6, 180 - (180 * yr) / years);
    p.fill(C.sapphire300).alpha(0.7);
    doc.circle(tx, ty, 0.35, 'F');
    p.alpha(1);
  }

  p.font('regular', 7).color(C.sapphire300);
  doc.text('Today', SX - SR, SY + 4.6, { align: 'center' });
  doc.text(`Year ${years}`, SX + SR, SY + 4.6, { align: 'center' });

  // The sun — only once it has risen (the system pays for itself within the outlook).
  // Clipped at the horizon, so near either end it rises or sets behind it.
  if (reached) {
    const [sx, sy] = polar(SX, SY, SR, sunDeg);
    doc.saveGraphicsState();
    doc.rect(0, 0, PAGE_W, SY, null);
    doc.clip();
    doc.discardPath();
    p.fill(C.thambili500);
    p.alpha(0.12);
    doc.circle(sx, sy, 7.2, 'F');
    p.alpha(0.22);
    doc.circle(sx, sy, 4.9, 'F');
    p.alpha(1);
    doc.circle(sx, sy, 3.1, 'F');
    doc.restoreGraphicsState();
  }

  // Caption inside the dome, clear of the sun wherever it sits on the arc
  let caption = ['Paid back', `after ${paybackLong(r.payback)}`];
  if (!r.hasCost) caption = ['Payback', 'needs the system cost'];
  else if (r.paybackYears == null) caption = ['No payback', 'with these figures'];
  else if (!reached) caption = ['Not paid back', `within ${years} years`];
  p.font('semibold', 8.5).color(C.paper);
  doc.text(caption[0], SX, SY - 10, { align: 'center' });
  p.font('regular', 7.5).color(C.sapphire300);
  doc.text(caption[1], SX, SY - 6, { align: 'center' });
}

// ---------------------------------------------------------------- KPI tiles

function drawTiles(doc, p, r, tou) {
  const gap = 5;
  const w = (CONTENT_W - gap * 2) / 3;
  const parts = paybackParts(r.payback);

  const tiles = [
    {
      label: 'Payback period',
      value: parts ? null : r.hasCost ? 'No payback' : '—',
      parts,
      note: !r.hasCost
        ? 'No system cost entered'
        : parts ? `Time to recover ${rs(r.investment)}` : 'The monthly benefit is below zero',
      emphasis: true,
    },
    tou
      ? {
          label: `Monthly ${benefitNoun(r)}`,
          value: rs(r.totalMonthlyIncome),
          note: r.battery.on
            ? 'Solar plus battery, after charging costs'
            : r.netPlus
              ? 'Every unit sold under Net Plus'
              : r.soldUnits > 0
                ? 'Bill saved plus surplus sold'
                : 'Taken off the electricity bill',
        }
      : {
          label: 'Monthly benefit',
          value: rs(r.totalMonthlyIncome),
          note: 'Bill saved plus export income',
        },
    {
      label: 'Annual return',
      value: r.investment > 0 ? percent(r.roi) : '—',
      note: 'First-year benefit ÷ system cost',
    },
  ];

  tiles.forEach((tile, i) => {
    const x = M + i * (w + gap);
    // soft shadow
    p.fill(C.sapphire900);
    [[1.6, 0.035], [1.0, 0.05], [0.5, 0.07]].forEach(([d, a]) => {
      p.alpha(a);
      doc.roundedRect(x - d * 0.35, TILE_Y + d, w + d * 0.7, TILE_H, 3.2, 3.2, 'F');
    });
    p.alpha(1);

    p.fill(tile.emphasis ? C.thambili500 : C.paper);
    doc.roundedRect(x, TILE_Y, w, TILE_H, 3, 3, 'F');

    const ink = C.sapphire900;
    const sub = tile.emphasis ? C.sapphire900 : C.slate600;
    p.font('medium', 8.5).color(sub);
    doc.text(tile.label, x + 5.5, TILE_Y + 8);

    const vy = TILE_Y + 18.6;
    if (tile.parts) {
      const pieces = [];
      tile.parts.forEach((part, idx) => {
        pieces.push({ text: part.value, font: 'display', size: 24, color: ink, gap: 1.1 });
        pieces.push({ text: part.unit, font: 'medium', size: 10.5, color: ink, gap: idx < tile.parts.length - 1 ? 2.6 : 0 });
      });
      runs(doc, p, pieces, x + 5.5, vy);
    } else {
      const size = fitSize(doc, p, 'display', tile.value, 24, w - 11, 14);
      p.font('display', size).color(ink);
      doc.text(tile.value, x + 5.5, vy);
    }

    p.font('regular', 7.6).color(sub);
    if (tile.emphasis) p.alpha(0.85);
    doc.text(tile.note, x + 5.5, TILE_Y + 24.6);
    p.alpha(1);
  });
}

// ------------------------------------------------------- monthly section

function sectionTitle(doc, p, text, x, y) {
  p.font('display', 13).color(C.sapphire900);
  doc.text(text, x, y);
}

function row(doc, p, label, value, x, y, w, { labelFont = 'regular', valueFont = 'semibold', size = 9, color = C.ink, labelColor = C.slate600 } = {}) {
  p.font(labelFont, size).color(labelColor);
  doc.text(label, x, y);
  p.font(valueFont, size).color(color);
  doc.text(value, x + w, y, { align: 'right' });
}

function drawMonthly(doc, p, r, top) {
  const colGap = 10;
  const colW = (CONTENT_W - colGap) / 2;
  const lx = M;
  const rx = M + colW + colGap;
  const surplus = r.unitBalance >= 0;

  // ---- Energy each month
  sectionTitle(doc, p, 'Energy each month', lx, top);

  const total = surplus ? r.generation : r.usage;
  const first = surplus ? r.usage : r.generation;
  const second = Math.abs(r.unitBalance);
  const secondColor = surplus ? C.thambili600 : C.slate400;

  const barY = top + 6;
  const barH = 6.5;
  const gap = 0.7;
  if (total > 0) {
    const w1 = second > 0 ? Math.max(0, (first / total) * colW - gap / 2) : colW;
    const w2 = second > 0 ? Math.max(0, colW - w1 - gap) : 0;
    // track
    p.fill(C.mist);
    doc.roundedRect(lx, barY, colW, barH, 1.3, 1.3, 'F');
    if (w1 > 0) {
      p.fill(C.sapphire600);
      const ops = w2 > 0
        ? [{ op: 'm', c: [lx, barY] }, { op: 'l', c: [lx + w1, barY] }, { op: 'l', c: [lx + w1, barY + barH] }, { op: 'l', c: [lx, barY + barH] }, { op: 'h', c: [] }]
        : null;
      if (ops) { doc.path(ops); doc.fill(); } else { doc.roundedRect(lx, barY, w1, barH, 1.3, 1.3, 'F'); doc.rect(lx, barY, Math.min(2, w1), barH, 'F'); }
    }
    if (w2 > 0) {
      p.fill(secondColor);
      const x2 = lx + w1 + gap;
      // rounded data end on the right, square where it meets the first segment
      const rr = Math.min(1.3, w2 / 2);
      doc.roundedRect(x2, barY, w2, barH, rr, rr, 'F');
      doc.rect(x2, barY, Math.min(rr, w2), barH, 'F');
    }
    // label inside the first segment when it fits
    p.font('semibold', 8);
    const inLabel = units(first);
    if (doc.getTextWidth(inLabel) + 5 < w1) {
      p.color(C.paper);
      doc.text(inLabel, lx + 2.6, barY + barH / 2 + 1.05);
    }
  }

  const ky = barY + barH + 7.5;
  const key = (color, label, value, y) => {
    p.fill(color);
    doc.roundedRect(lx, y - 2.55, 2.8, 2.8, 0.5, 0.5, 'F');
    row(doc, p, label, value, lx + 5, y, colW - 5);
  };
  key(C.sapphire600, surplus ? 'Covers your own usage' : 'Covered by solar', units(first), ky);
  key(secondColor, surplus ? 'Sold to the grid' : 'Bought from the grid', units(second), ky + 6);

  p.stroke(C.line).width(0.25);
  doc.line(lx, ky + 9.6, lx + colW, ky + 9.6);
  row(doc, p, surplus ? 'Solar generated' : 'Your usage', units(total), lx, ky + 15, colW, {
    labelFont: 'semibold', labelColor: C.ink, valueFont: 'semibold',
  });

  // ---- Monthly benefit
  sectionTitle(doc, p, 'Your monthly benefit', rx, top);
  let y = top + 11.2;
  row(doc, p, 'Electricity bill saved', rs(r.lightBill), rx, y, colW);
  y += 6;
  row(doc, p, surplus ? 'Export income' : 'Extra units from the grid', rs(r.monthlyUnitIncome), rx, y, colW, {
    color: r.monthlyUnitIncome < 0 ? C.thambili600 : C.ink,
  });
  p.font('regular', 7.4).color(C.slate400);
  doc.text(`${num(Math.abs(r.unitBalance))} ${Math.abs(Math.round(r.unitBalance)) === 1 ? 'unit' : 'units'} × ${rsRate(r.unitValue)}`, rx, y + 3.9);

  const boxY = ky + 9.6 + 0.4;
  const boxH = 9.2;
  p.fill(C.sapphire900);
  doc.roundedRect(rx, boxY - 4.6, colW, boxH, 2, 2, 'F');
  p.font('semibold', 9).color(C.sapphire300);
  doc.text('Total monthly benefit', rx + 4, boxY + 1.2);
  p.font('display', 13).color(C.paper);
  doc.text(rs(r.totalMonthlyIncome), rx + colW - 4, boxY + 1.6, { align: 'right' });

  return Math.max(ky + 15, boxY + boxH - 4.6);
}

// ------------------------------------------------- time-of-use bill table

const TOU_LINES = [
  { key: 'day', label: touPeriods.day.label, when: touPeriods.day.window },
  { key: 'peak', label: touPeriods.peak.label, when: touPeriods.peak.window },
  { key: 'offPeak', label: touPeriods.offPeak.label, when: touPeriods.offPeak.window },
  { key: 'demand', label: 'Max demand', unit: ' kVA' },
  { key: 'fixed', label: 'Fixed charge' },
];

// Lines that solar or the battery bring down are green; lines that go up (overnight charging) are orange.
function changeColour(base, value) {
  if (value < base - 0.004) return C.tea700;
  if (value > base + 0.004) return C.thambili800;
  return null;
}

// The bill laid out like a CEB/EDL or LECO bill: today, with solar, and with solar and a battery.
function drawTouBill(doc, p, r, top) {
  const battery = r.battery.on;
  const groups = [
    { label: 'Today', bill: r.today },
    { label: r.netPlus ? 'With Net Plus' : 'With solar', bill: r.withSolar },
  ];
  if (battery) groups.push({ label: 'Solar + battery', bill: r.withBattery });
  sectionTitle(
    doc,
    p,
    battery ? 'Your monthly bill: today, with solar, and with a battery' : `Your monthly bill, today and ${r.netPlus ? 'with Net Plus' : 'with solar'}`,
    M,
    top,
  );

  // Right edges of the columns. Each group is a units column and an amount column.
  const unitsW = battery ? 17 : 22;
  const amountW = battery ? 23 : 28;
  const right = PAGE_W - M;
  const cols = groups.map((grp, i) => {
    const amount = right - (groups.length - 1 - i) * (unitsW + amountW);
    return { ...grp, amount, units: amount - amountW };
  });
  const rateX = cols[0].units - unitsW - 3;
  const rule = (y, color = C.line, w = 0.2) => {
    p.stroke(color).width(w);
    doc.line(M, y, right, y);
  };

  let y = top + 7.2;
  p.font('semibold', 7.8).color(C.ink);
  for (const c of cols) doc.text(c.label, c.amount, y, { align: 'right' });
  y += 3.8;
  p.font('medium', 7).color(C.slate600);
  doc.text('Charge', M, y);
  doc.text('Rate (Rs.)', rateX, y, { align: 'right' });
  for (const c of cols) {
    doc.text('Units', c.units, y, { align: 'right' });
    doc.text('Rs.', c.amount, y, { align: 'right' });
  }
  rule(y + 1.8, C.line, 0.25);

  const pitch = 5.2;
  const line = (label, when, key, rateText, unit = '') => {
    y += pitch;
    runs(doc, p, [
      { text: label, font: 'semibold', size: 8.2, color: C.ink, gap: when ? 1.4 : 0 },
      ...(when ? [{ text: when, font: 'regular', size: 6.9, color: C.slate600 }] : []),
    ], M, y);
    p.font('regular', 8.2).color(C.ink);
    if (rateText) doc.text(rateText, rateX, y, { align: 'right' });
    const base = key === 'levy' ? r.today.levy : r.today.lines[key].amount;
    for (const c of cols) {
      const item = key === 'levy' ? { amount: c.bill.levy, quantity: null } : c.bill.lines[key];
      const colour = c.bill === r.today ? null : changeColour(base, item.amount);
      p.font(colour ? 'semibold' : 'regular', 8.2).color(colour ?? C.ink);
      if (item.quantity != null) {
        const q = key === 'demand' ? item.quantity : Math.round(item.quantity);
        doc.text(`${qty(q)}${unit}`, c.units, y, { align: 'right' });
      }
      doc.text(num(item.amount), c.amount, y, { align: 'right' });
    }
    rule(y + 1.9);
  };

  for (const l of TOU_LINES) {
    const rate = r.today.lines[l.key].rate;
    line(l.label, l.when, l.key, rate == null ? '' : formatTyped(rate, 2), l.unit);
  }
  if (r.sscl) line('SSC Levy', '2.5% of the total', 'levy', '');

  y += 6.6;
  p.font('semibold', 9).color(C.sapphire900);
  doc.text('Monthly bill', M, y);
  for (const c of cols) {
    const colour = c.bill === r.today ? null : changeColour(r.today.total, c.bill.total);
    p.font('display', battery ? 11 : 12.5).color(colour ?? C.sapphire900);
    doc.text(rs(c.bill.total), c.amount, y, { align: 'right' });
  }
  return y + 2;
}

// Where the monthly saving comes from, with the total in a dark box.
function drawTouSavings(doc, p, r, top) {
  const b = r.battery;
  const noun = benefitNoun(r);
  const rows = [];
  rows.push([r.netPlus ? 'Solar: bill saved' : 'Solar: Day units replaced', rs(r.billSaving)]);
  if (r.netPlus || r.soldUnits > 0) rows.push([r.netPlus ? 'Solar: units sold (Net Plus)' : 'Solar: surplus sold', rs(r.solarIncome)]);
  if (b.on) {
    if (b.plan.peak > 0) rows.push([`Battery: ${units(b.plan.peak)} of Peak replaced`, rs(b.parts.peak)]);
    if (b.plan.offPeak > 0) rows.push([`Battery: ${units(b.plan.offPeak)} of Off-peak replaced`, rs(b.parts.offPeak)]);
    rows.push(
      b.demandCounted > 0
        ? [`Battery: max demand, ${qty(b.demandCounted)} kVA (confirmed)`, rs(b.parts.demand)]
        : ['Battery: max demand', 'not counted', 'muted'],
    );
    if (b.plan.chargedIn > 0) rows.push([`Battery: charging cost, ${units(b.plan.chargedIn)} put in`, rs(-b.parts.charging), 'cost']);
  }

  sectionTitle(doc, p, `Your monthly ${noun}`, M, top);
  const boxW = 66;
  const listW = CONTENT_W - boxW - 10;
  const pitch = 4.5;
  let y = top + 6.5;
  for (const [label, value, kind] of rows) {
    p.font('regular', 7.9).color(C.slate600);
    doc.text(label, M, y);
    p.font(kind === 'muted' ? 'regular' : 'semibold', 7.9).color(kind === 'cost' ? C.thambili800 : kind === 'muted' ? C.slate600 : C.ink);
    doc.text(value, M + listW, y, { align: 'right' });
    y += pitch;
  }

  const boxH = Math.max(14, rows.length * pitch + 1);
  const bx = PAGE_W - M - boxW;
  const by = top + 3;
  p.fill(C.sapphire900);
  doc.roundedRect(bx, by, boxW, boxH, 2.2, 2.2, 'F');
  p.font('semibold', 8.4).color(C.sapphire300);
  doc.text(`Total monthly ${noun}`, bx + 5, by + boxH / 2 - 1.6);
  p.font('display', 15).color(C.paper);
  doc.text(rs(r.totalMonthlyIncome), bx + 5, by + boxH / 2 + 5);
  if (r.sscl) {
    p.font('regular', 6.6).color(C.slate600);
    doc.text('Amounts include the 2.5% SSC Levy.', M, y + 0.4);
  }
  return Math.max(y + 1, by + boxH);
}

// The battery's day in four moments.
function drawBatteryDay(doc, p, r, top) {
  sectionTitle(doc, p, 'How the battery runs each day', M, top);
  const steps = batteryStory(r);
  const gap = 4;
  const w = (CONTENT_W - gap * 3) / 4;
  const h = 27;
  const by = top + 4;
  const NAMES = { sun: 'Solar', grid: 'Grid', battery: 'Battery', site: 'Site' };
  steps.forEach((s, i) => {
    const x = M + i * (w + gap);
    p.fill(C.mist);
    doc.roundedRect(x, by, w, h, 2, 2, 'F');
    runs(doc, p, [
      { text: s.title, font: 'semibold', size: 8, color: C.ink, gap: 1.4 },
      { text: s.when, font: 'regular', size: 6.6, color: C.slate600 },
    ], x + 3, by + 5);
    let ty = by + 9.4;
    for (const f of s.flows.filter((fl) => fl.on)) {
      // "Grid → Battery", with the arrow drawn (the report font has no arrow glyph)
      p.font('semibold', 6.8).color(C.thambili800);
      const from = NAMES[f.from];
      doc.text(from, x + 3, ty);
      const ax = x + 3 + doc.getTextWidth(from) + 1.2;
      p.stroke(C.thambili800).width(0.3);
      doc.line(ax, ty - 0.85, ax + 3, ty - 0.85);
      p.fill(C.thambili800);
      doc.triangle(ax + 2.8, ty - 1.75, ax + 4.3, ty - 0.85, ax + 2.8, ty + 0.05, 'F');
      doc.text(NAMES[f.to], ax + 5.4, ty);
      ty += 3.1;
    }
    p.font('regular', 6.8).color(C.ink);
    const lines = doc.splitTextToSize(s.text, w - 6);
    doc.text(lines.slice(0, 4), x + 3, ty + 0.6, { lineHeightFactor: 1.25 });
  });
  return by + h;
}

// One bar per period: what solar, the battery and the grid each supply.
function drawUnitsBars(doc, p, r, top) {
  const b = r.battery;
  const pl = b.plan;
  const solarOnDay = r.netPlus ? 0 : Math.max(0, r.solarToDay - (b.on ? pl.charge.daySolar : 0));
  const rows = [
    ['Day', [['own', solarOnDay], ['grid', r.withBattery.lines.day.quantity]]],
    ['Peak', [['battery', b.on ? pl.peak : 0], ['grid', r.peakUnits - (b.on ? pl.peak : 0)]]],
    ['Off-peak', [['battery', b.on ? pl.offPeak : 0], ['grid', r.offPeakUnits - (b.on ? pl.offPeak : 0)]]],
  ];
  if (b.on && pl.chargedIn > 0) rows.push(['Charging', [['own', pl.charge.surplus + pl.charge.daySolar], ['grid', pl.charge.grid]]]);
  const sold = r.netPlus ? r.soldUnits : Math.max(0, r.soldUnits - (b.on ? pl.charge.surplus : 0));
  if (sold > 0) rows.push([r.netPlus ? 'Sold' : 'Surplus', [['sold', sold]]]);

  const colours = { own: C.sapphire600, battery: C.thambili600, grid: C.slate400, sold: C.tea700 };
  const names = { own: 'From solar', battery: 'From the battery', grid: 'From the grid', sold: 'Sold to the grid' };
  sectionTitle(doc, p, 'Units by time of day', M, top);

  // legend, right-aligned on the title line
  const used = new Set(rows.flatMap(([, parts]) => parts.filter(([, v]) => v > 0.5).map(([k]) => k)));
  let lx = PAGE_W - M;
  p.font('regular', 7.4);
  for (const kind of ['sold', 'grid', 'battery', 'own'].filter((k) => used.has(k))) {
    const label = names[kind];
    const tw = doc.getTextWidth(label);
    p.color(C.slate600);
    doc.text(label, lx, top, { align: 'right' });
    p.fill(colours[kind]);
    doc.roundedRect(lx - tw - 3.8, top - 2.4, 2.6, 2.6, 0.5, 0.5, 'F');
    lx -= tw + 3.8 + 4.5;
  }

  const labelW = 20;
  const valueW = 16;
  const trackW = CONTENT_W - labelW - valueW;
  const totals = rows.map(([, parts]) => parts.reduce((sum, [, v]) => sum + v, 0));
  const max = Math.max(1, ...totals);
  let y = top + 5;
  rows.forEach(([label, parts], i) => {
    p.font('semibold', 7.8).color(C.ink);
    doc.text(label, M, y + 2.6);
    let x = M + labelW;
    const full = (totals[i] / max) * trackW;
    const shown = parts.filter(([, v]) => v > 0.5);
    shown.forEach(([kind, v], j) => {
      const w = Math.max(0.6, (v / totals[i]) * full - (j < shown.length - 1 ? 0.5 : 0));
      p.fill(colours[kind]);
      doc.rect(x, y, w, 3.4, 'F');
      x += w + 0.5;
    });
    p.font('semibold', 7.8).color(C.ink);
    doc.text(qty(Math.round(totals[i])), PAGE_W - M, y + 2.6, { align: 'right' });
    y += 5.2;
  });
  return y;
}

// ------------------------------------------------- page 2: investment

// A slim version of the page-one band for the following pages.
function drawPageBand(doc, p, now, logo, title) {
  const h = 22;
  p.fill(C.sapphire900);
  doc.rect(0, 0, PAGE_W, h, 'F');
  let x = M;
  if (logo) {
    const lh = 9;
    const lw = Math.min(30, lh * logo.aspect);
    doc.addImage(logo.dataUrl, 'PNG', M, (h - lh) / 2, lw, lh, 'brand-logo', 'SLOW');
    x = M + lw + 3.5;
  } else {
    drawEmblem(doc, p, M, 6, 9);
    x = M + 12;
  }
  p.font('display', 11).color(C.paper);
  doc.text(company.name, x, 10);
  p.font('regular', 7.6).color(C.sapphire300);
  doc.text(title, x, 14.6);
  p.font('medium', 8).color(C.paper);
  doc.text(reportNumber(now), PAGE_W - M, 10, { align: 'right' });
  p.font('regular', 7.4).color(C.sapphire300);
  doc.text(formatDate(now), PAGE_W - M, 14.6, { align: 'right' });
}

// Four figures that sum up the investment.
function drawReturnsFacts(doc, p, r, top) {
  sectionTitle(doc, p, 'Investment and returns', M, top);
  const cells = [
    { label: 'Total investment', value: rs(r.investment) },
    { label: 'Net saving, first year', value: rs(r.firstYearNet) },
    { label: 'Simple payback', value: r.simplePaybackYears == null ? '—' : `${formatTyped(Math.round(r.simplePaybackYears * 10) / 10, 'auto')} years` },
    { label: `Net present value at ${formatTyped(r.discountRate * 100, 'auto')}%`, value: rs(r.npv), colour: r.npv < 0 ? C.thambili800 : C.sapphire900 },
  ];
  const h = 17;
  const by = top + 4;
  p.fill(C.mist);
  doc.roundedRect(M, by, CONTENT_W, h, 2.6, 2.6, 'F');
  const cw = CONTENT_W / cells.length;
  cells.forEach((cell, i) => {
    const x = M + cw * i + 5;
    if (i > 0) {
      p.stroke(C.line).width(0.25);
      doc.line(M + cw * i, by + 3.5, M + cw * i, by + h - 3.5);
    }
    p.font('medium', 7.6).color(C.slate600);
    doc.text(cell.label, x, by + 6);
    const size = fitSize(doc, p, 'display', cell.value, 14, cw - 9, 10);
    p.font('display', size).color(cell.colour ?? C.sapphire900);
    doc.text(cell.value, x, by + 12.6);
  });

  const parts = [`Solar ${rs(r.costs.solar)}`];
  if (r.battery.on) parts.push(`battery ${rs(r.costs.battery)}`);
  if (r.costs.other > 0) parts.push(`other ${rs(r.costs.other)}`);
  let text = `${parts.join(' + ')}. Maintenance ${rs(r.maintenance)} a year.`;
  if (r.replacementYears.length) {
    text += ` Battery replaced in year ${r.replacementYears.join(' and ')} for ${rs(r.finance.replacement * r.costs.battery)}.`;
  }
  p.font('regular', 7.8).color(C.slate600);
  doc.text(text, M, by + h + 5);
  return by + h + 6;
}

// Where the customer stands after 5, 10, 15 and 20 years.
function drawMilestones(doc, p, r, top) {
  const h = 17;
  p.fill(C.mist);
  doc.roundedRect(M, top, CONTENT_W, h, 2.6, 2.6, 'F');
  const cw = CONTENT_W / r.milestones.length;
  r.milestones.forEach((m, i) => {
    const x = M + cw * i + 5;
    if (i > 0) {
      p.stroke(C.line).width(0.25);
      doc.line(M + cw * i, top + 3.5, M + cw * i, top + h - 3.5);
    }
    p.font('medium', 7.6).color(C.slate600);
    doc.text(`After ${m.year} years`, x, top + 6);
    const value = rs(m.position);
    const size = fitSize(doc, p, 'display', value, 14, cw - 9, 10);
    p.font('display', size).color(m.position >= 0 ? C.tea600 : C.sapphire900);
    doc.text(value, x, top + 12.6);
  });
  return top + h;
}

// Twenty years in two side-by-side tables.
function drawYearTable(doc, p, r, top) {
  sectionTitle(doc, p, 'Year by year', M, top);
  const half = Math.ceil(r.yearly.length / 2);
  const colW = (CONTENT_W - 10) / 2;
  [r.yearly.slice(0, half), r.yearly.slice(half)].forEach((rows, t) => {
    const x = M + t * (colW + 10);
    let y = top + 6;
    p.font('medium', 7).color(C.slate600);
    doc.text('Year', x, y);
    doc.text('Saving', x + colW * 0.42, y, { align: 'right' });
    doc.text('Costs', x + colW * 0.66, y, { align: 'right' });
    doc.text('Position', x + colW, y, { align: 'right' });
    p.stroke(C.line).width(0.25);
    doc.line(x, y + 1.6, x + colW, y + 1.6);
    for (const row of rows) {
      y += 4.3;
      p.font('regular', 7.6).color(C.ink);
      doc.text(String(row.year), x, y);
      doc.text(num(row.saving), x + colW * 0.42, y, { align: 'right' });
      const costs = row.maintenance + row.replacement;
      p.color(row.replacement > 0 ? C.thambili800 : C.ink);
      doc.text(`${costs > 0 ? '−' : ''}${num(costs)}${row.replacement > 0 ? '*' : ''}`, x + colW * 0.66, y, { align: 'right' });
      p.font('semibold', 7.6).color(row.position >= 0 ? C.tea700 : C.ink);
      doc.text(num(row.position), x + colW, y, { align: 'right' });
    }
  });
  let y = top + 6 + half * 4.3 + 4.6;
  p.font('regular', 6.8).color(C.slate600);
  const foot = `Amounts in Rs. Saving is after panel${r.battery.on ? ' and battery' : ''} ageing; costs are maintenance${
    r.replacementYears.length ? ' and, marked *, the battery replacement' : ''
  }; position is where the customer stands after paying for the system.`;
  doc.text(foot, M, y);
  return y + 1;
}

// What the figures assume, as a short list.
function drawAssumptions(doc, p, r, details, top) {
  sectionTitle(doc, p, 'What these figures assume', M, top);
  const b = r.battery;
  const pct = (share) => `${formatTyped(Math.round(share * 1000) / 10, 'auto')}%`;
  const items = [];
  items.push(
    `The bill: the units and rates shown${details.tariff ? ` (${details.tariff} tariff)` : ''}, the same every month${
      r.sscl ? ', with the 2.5% SSC Levy' : ''
    }. Tariff revisions are not included.`,
  );
  items.push(
    r.netPlus
      ? `Solar: ${units(r.generation)} a month, all sold under Net Plus at ${rsRate(r.exportRate)}; output falls ${pct(r.finance.solarLoss)} a year.`
      : `Solar: ${units(r.generation)} a month, set off against Day units${r.soldUnits > 0 ? `, surplus paid at ${rsRate(r.exportRate)}` : ''}; output falls ${pct(r.finance.solarLoss)} a year.`,
  );
  if (b.on) {
    const modes = { smart: 'smart (most profitable use)', peak: 'peak hours', offPeak: 'off-peak hours', demand: 'maximum demand' };
    const sources = { both: 'solar and grid', solar: 'solar only', grid: 'grid only' };
    items.push(
      `Battery: ${qty(b.capacity)} kWh with a ${qty(b.power)} kW inverter, ${pct(b.usable)} usable, ${pct(b.efficiency)} round trip, one cycle a day (${qty(b.days)} a month); used for ${modes[b.mode]}, charged from ${sources[b.charging]}.`,
    );
    items.push(
      'Charging is a cost: grid units overnight at the Off-peak rate, and solar put into the battery no longer replaces Day units or earns its export payment, so no unit is counted twice.',
    );
    items.push(
      b.demandCounted > 0
        ? `Maximum demand: a ${qty(b.demandCounted)} kVA reduction is counted, confirmed from half-hourly load data.`
        : 'Maximum demand: no saving is counted. A battery only lowers the kVA charge when half-hourly load data shows it can hold the peak down.',
    );
    items.push(
      `Battery ageing: capacity falls ${pct(r.finance.batteryLoss)} a year; replaced after ${r.finance.batteryLife} years at ${pct(r.finance.replacement)} of today’s price.`,
    );
  }
  items.push(
    `Maintenance ${pct(r.finance.maintenance)} of the investment a year. Net present value discounts each year at ${pct(r.discountRate)}. Battery figures are estimates from monthly bill units, to be confirmed by a site survey.`,
  );
  if (assumptions.showCleanEnergy && r.generation > 0) {
    items.push(
      `Clean energy: about ${tonnes(r.co2PerYearKg)} tonnes of CO2 avoided each year (${assumptions.co2KgPerUnit} kg per solar unit), as much as ${num(r.treesEquivalent)} mature trees absorb.`,
    );
  }

  let y = top + 6;
  p.font('regular', 7.3);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, CONTENT_W - 4);
    p.fill(C.thambili500);
    doc.circle(M + 0.9, y - 1, 0.6, 'F');
    p.color(C.ink);
    doc.text(lines, M + 4, y, { lineHeightFactor: 1.3 });
    y += lines.length * 3.3 + 1.2;
  }
  return y;
}

// ------------------------------------------------------------ cash chart

function drawCashChart(doc, p, r, top, plotH = 50) {
  sectionTitle(doc, p, `Your ${r.years}-year cash position`, M, top);
  p.font('regular', 8).color(C.slate600);
  doc.text('Where you stand at the end of each year after paying for the system', M, top + 5);

  // legend (right)
  const legend = [
    { color: C.slate400, label: 'Recovering the cost' },
    { color: C.tea600, label: 'Ahead' },
  ];
  let lgx = PAGE_W - M;
  p.font('regular', 8);
  for (const item of [...legend].reverse()) {
    const w = doc.getTextWidth(item.label);
    p.color(C.slate600);
    doc.text(item.label, lgx, top, { align: 'right' });
    p.fill(item.color);
    doc.roundedRect(lgx - w - 4.2, top - 2.55, 2.8, 2.8, 0.5, 0.5, 'F');
    lgx -= w + 4.2 + 5;
  }

  const values = r.cumulative;
  const axisW = 15;
  const plotX = M + axisW;
  const plotW = CONTENT_W - axisW;
  const plotTop = top + 12;
  const plotBottom = plotTop + plotH;

  const { lo, hi, ticks } = cashScale(values);
  const yOf = (v) => plotTop + ((hi - v) / (hi - lo)) * plotH;

  // grid + y labels
  for (const v of ticks) {
    const gy = yOf(v);
    p.stroke(v === 0 ? C.slate400 : C.line).width(v === 0 ? 0.3 : 0.2);
    doc.line(plotX, gy, plotX + plotW, gy);
    p.font('regular', 7).color(C.slate600);
    doc.text(v === 0 ? '0' : `Rs. ${rsCompact(v)}`, plotX - 2.5, gy + 1.1, { align: 'right' });
  }

  const n = values.length;
  const slot = plotW / n;
  const colW = Math.min(5.2, slot * 0.58);
  const zeroY = yOf(0);

  values.forEach((v, i) => {
    const cx = plotX + slot * i + (slot - colW) / 2;
    const h = (Math.abs(v) / (hi - lo)) * plotH;
    if (h < 0.15) return;
    p.fill(v >= 0 ? C.tea600 : C.slate400);
    doc.path(columnOps(cx, zeroY, colW, v >= 0 ? h : -h, 1.1));
    doc.fill();
  });

  // x labels
  p.font('regular', 7).color(C.slate600);
  for (let i = 0; i < n; i += 5) {
    const cx = plotX + slot * i + slot / 2;
    doc.text(i === 0 ? 'Now' : `${i} yrs`, cx, plotBottom + 4.6, { align: 'center' });
  }

  // selective direct labels: the starting cost and the final position
  const first = values[0];
  const last = values[n - 1];
  p.font('semibold', 7.2).color(C.ink);
  if (first < 0) {
    doc.text(rs(first), plotX + slot / 2 - colW / 2, yOf(first) + 3.6, { align: 'left' });
  }
  if (last > 0) {
    doc.text(rs(last), plotX + slot * (n - 1) + slot / 2 + colW / 2, yOf(last) - 1.8, { align: 'right' });
  }

  // payback marker on the zero line, labelled with the longest wording that clears
  // the columns and the end label
  if (r.paybackYears != null && r.paybackYears > 0 && r.paybackYears <= r.years) {
    const px = plotX + slot * r.paybackYears + slot / 2;
    p.font('semibold', 7.2);
    const endW = last > 0 ? doc.getTextWidth(rs(last)) : 0;
    const endX = plotX + slot * (n - 1) + slot / 2 + colW / 2;
    const endBox = last > 0 ? { x0: endX - endW, x1: endX, y0: yOf(last) - 5, y1: yOf(last) - 0.5 } : null;
    const candidates = [
      `Paid back after ${paybackLong(r.payback)}`,
      `Paid back in ${paybackShort(r.payback)}`,
      'Paid back',
    ];
    p.font('semibold', 7.6);
    for (const [k, label] of candidates.entries()) {
      const lw = doc.getTextWidth(label);
      const flip = px + 1.6 + lw > plotX + plotW;
      const x0 = flip ? px - 1.6 - lw : px + 1.6;
      let tallest = 0;
      values.forEach((v, i) => {
        const cx = plotX + slot * i + slot / 2;
        if (v > 0 && cx + colW / 2 > x0 - 1 && cx - colW / 2 < x0 + lw + 1) tallest = Math.max(tallest, zeroY - yOf(v));
      });
      const wanted = zeroY - Math.max(14, tallest + 5);
      const labelY = Math.max(plotTop + 4, wanted);
      const hitsEnd = endBox && x0 < endBox.x1 && x0 + lw > endBox.x0 && labelY - 3 < endBox.y1 && labelY + 1 > endBox.y0;
      if ((wanted >= plotTop + 4 && !hitsEnd) || k === candidates.length - 1) {
        p.stroke(C.thambili600).width(0.3);
        doc.line(px, zeroY - 2, px, labelY + 1.2);
        p.font('semibold', 7.6).color(C.ink);
        doc.text(label, x0, labelY);
        break;
      }
    }
    p.fill(C.paper);
    doc.circle(px, zeroY, 2.3, 'F');
    p.fill(C.thambili500);
    doc.circle(px, zeroY, 1.6, 'F');
  }

  return plotBottom + 6;
}

// --------------------------------------------------------- income totals

function drawTotals(doc, p, r, top, { h = 20, noun = 'income' } = {}) {
  p.fill(C.mist);
  doc.roundedRect(M, top, CONTENT_W, h, 2.6, 2.6, 'F');

  const cells = [
    { label: `1-year ${noun}`, value: rs(r.yearIncome) },
    { label: `10-year ${noun}`, value: rs(r.year10Income) },
    { label: `${r.years}-year ${noun}`, value: rs(r.year20Income) },
    { label: `${r.years}-year net gain`, value: rs(r.netGain), note: 'after the system cost', strong: true },
  ];
  const cw = CONTENT_W / cells.length;
  cells.forEach((cell, i) => {
    const x = M + cw * i + 5;
    if (i > 0) {
      p.stroke(C.line).width(0.25);
      doc.line(M + cw * i, top + 4, M + cw * i, top + h - 4);
    }
    p.font('medium', 8).color(C.slate600);
    doc.text(cell.label, x, top + h * 0.35);
    const color = cell.strong ? (r.netGain >= 0 ? C.tea600 : C.thambili600) : C.sapphire900;
    const size = fitSize(doc, p, 'display', cell.value, 14.5, cw - 9, 10);
    p.font('display', size).color(color);
    doc.text(cell.value, x, top + h * 0.73);
  });
  return top + h;
}

// ------------------------------------------------- clean energy + notes

function drawNotes(doc, p, r, top, note = null) {
  let y = top;
  if (assumptions.showCleanEnergy && r.generation > 0) {
    // leaf: two arcs meeting at the tips
    const lx = M + 2.2;
    const ly = y - 1.2;
    p.fill(C.tea600);
    doc.path([
      { op: 'm', c: [lx - 2, ly + 2] },
      { op: 'c', c: [lx - 2, ly - 0.8, lx + 0.2, ly - 2.4, lx + 2.4, ly - 2.4] },
      { op: 'c', c: [lx + 2.4, ly + 0.4, lx + 0.6, ly + 2, lx - 2, ly + 2] },
      { op: 'h', c: [] },
    ]);
    doc.fill();

    const t1 = tonnes(r.co2PerYearKg);
    const tAll = tonnes(r.co2TotalKg);
    const trees = num(r.treesEquivalent);
    const base = { font: 'regular', size: 8.6, color: C.ink };
    const strong = { font: 'semibold', size: 8.6, color: C.ink };
    const sub = { font: 'regular', size: 6, color: C.ink, dy: 0.9, gap: 0.2 };
    runs(doc, p, [
      { ...strong, text: 'Clean energy: ' },
      { ...base, text: `about ${t1} tonnes of CO` },
      { ...sub, text: '2' },
      { ...base, text: ` avoided each year and ${tAll} tonnes over ${r.years} years, ` },
      { ...base, text: `as much as ${trees} mature trees absorb in a year.` },
    ], M + 7, y);
    y += 7;
  }

  const text = `${
    note ??
    'Estimates based on the figures shown, assuming they stay the same every month with no panel ageing or tariff changes. Actual results depend on weather, system performance, consumption and CEB/LECO tariff revisions.'
  }${assumptions.showCleanEnergy ? ` Clean-energy figure uses ${assumptions.co2KgPerUnit} kg per unit generated.` : ''}`;
  p.font('regular', 7).color(C.slate600);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, M, y, { lineHeightFactor: 1.35 });
}

// ---------------------------------------------------------------- footer

function drawFooter(doc, p) {
  const top = 278;
  p.fill(C.sapphire900);
  doc.rect(0, top, PAGE_W, PAGE_H - top, 'F');
  p.fill(C.thambili500);
  doc.rect(0, top, PAGE_W, 1, 'F');

  p.font('display', 10.5).color(C.paper);
  doc.text(company.legalName, M, top + 8.2);
  p.font('regular', 8).color(C.sapphire300);
  doc.text(company.address.join(', '), M, top + 13);

  p.font('medium', 9).color(C.paper);
  const site = company.websiteLabel;
  const sw = doc.getTextWidth(site);
  doc.textWithLink(site, PAGE_W - M - sw, top + 8.2, { url: company.website });

  const contact = [company.phone, company.email].filter(Boolean).join('   ');
  if (contact) {
    p.font('regular', 8).color(C.sapphire300);
    doc.text(contact, PAGE_W - M, top + 13, { align: 'right' });
  }
}
