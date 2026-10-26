// Browser side of the PDF export: loads jsPDF, the fonts and the logo, then draws and saves.
// This file (and jsPDF) is only downloaded when someone clicks "Download PDF report".

import { jsPDF } from 'jspdf';
import { drawReport, reportFileName } from './drawReport.js';
import { logoUrl } from '../brandAssets.js';

import barlowRegular from '../../assets/fonts/Barlow-Regular.ttf?url';
import barlowMedium from '../../assets/fonts/Barlow-Medium.ttf?url';
import barlowSemiBold from '../../assets/fonts/Barlow-SemiBold.ttf?url';
import barlowSCBold from '../../assets/fonts/BarlowSemiCondensed-Bold.ttf?url';

const FONT_FILES = {
  regular: { url: barlowRegular, file: 'Barlow-Regular.ttf', name: 'Barlow' },
  medium: { url: barlowMedium, file: 'Barlow-Medium.ttf', name: 'BarlowMedium' },
  semibold: { url: barlowSemiBold, file: 'Barlow-SemiBold.ttf', name: 'BarlowSemiBold' },
  display: { url: barlowSCBold, file: 'BarlowSemiCondensed-Bold.ttf', name: 'BarlowSC' },
};

// If the fonts can't be fetched the report still works, in the built-in Helvetica.
const FALLBACK_FONTS = {
  regular: ['helvetica', 'normal'],
  medium: ['helvetica', 'normal'],
  semibold: ['helvetica', 'bold'],
  display: ['helvetica', 'bold'],
};

let fontData = null;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function loadFonts() {
  if (fontData) return fontData;
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([kind, font]) => {
      const res = await fetch(font.url);
      if (!res.ok) throw new Error(`Font ${font.file} returned ${res.status}`);
      return [kind, toBase64(await res.arrayBuffer())];
    }),
  );
  fontData = Object.fromEntries(entries);
  return fontData;
}

async function registerFonts(doc) {
  try {
    const data = await loadFonts();
    const fonts = {};
    for (const [kind, font] of Object.entries(FONT_FILES)) {
      doc.addFileToVFS(font.file, data[kind]);
      doc.addFont(font.file, font.name, 'normal');
      fonts[kind] = [font.name, 'normal'];
    }
    return fonts;
  } catch (err) {
    console.warn('Using built-in PDF fonts:', err);
    return FALLBACK_FONTS;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// Any logo format (SVG, PNG, JPG, WebP) is redrawn as a PNG for the PDF.
async function loadLogo() {
  if (!logoUrl) return null;
  try {
    const img = await loadImage(logoUrl);
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 200;
    // Keep the file's own resolution (an SVG is drawn at 300px), capped at 400px tall.
    const height = Math.min(400, img.naturalHeight || 300);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((w / h) * height);
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), aspect: w / h };
  } catch (err) {
    console.warn('Logo skipped in PDF:', err);
    return null;
  }
}

export async function downloadReport({ results, details, now = new Date() }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const [fonts, logo] = await Promise.all([registerFonts(doc), loadLogo()]);
  drawReport(doc, { results, details, now, fonts, logo });
  doc.save(reportFileName(details, now));
}
