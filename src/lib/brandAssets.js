// Picks up a logo file from src/assets/brand/ automatically (logo.png, logo.svg, logo.jpg or logo.webp).
// With no file there, the built-in sun mark is used on the website and the PDF.
const found = import.meta.glob('../assets/brand/logo.{png,svg,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const logoUrl = Object.values(found)[0] ?? null;
