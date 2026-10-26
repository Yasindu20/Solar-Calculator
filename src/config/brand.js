// Brand colours, shared by the website (as CSS variables) and the PDF report.
// Change a hex value here and both update.
//
// sapphire — deep blue of Ceylon sapphire: headings, the result panel, report header
// thambili — king-coconut orange: the sun, the main button, energy sold to the grid
// tea      — tea-leaf green: money gained

export const colors = {
  sapphire900: '#13245E',
  sapphire800: '#1B3176',
  sapphire700: '#3A5AAE',
  sapphire600: '#2F5BD0',
  sapphire300: '#B8C7EE',
  sapphire100: '#E6ECF9',

  thambili500: '#F5A021',
  thambili600: '#DD7410',
  thambili100: '#FDEBD0',

  tea600: '#1D8A5A',
  tea100: '#E2F3EA',

  ink: '#18233F',
  slate600: '#56657D',
  slate400: '#7A879C',
  line: '#DCE3EE',
  mist: '#F3F6FB',
  paper: '#FFFFFF',
};

// Exposes the palette to CSS as --c-sapphire900, --c-thambili500, …
export function applyBrandColors(root = document.documentElement) {
  for (const [name, value] of Object.entries(colors)) {
    root.style.setProperty(`--c-${name}`, value);
  }
}
