# Company logo

`logo.png` here is the round lightning-bolt emblem from the Ceylon Energy & Engineering Services logo, cut out with a
thin white rim and a transparent background. It appears in front of the company name on the website and in the PDF
report, and the site icons in `public/` are made from it.

To use a different logo, replace `logo.png` (or add `logo.svg`, `logo.jpg` or `logo.webp` instead).

- In the PDF the logo sits directly on the dark blue header. A logo made for white paper needs `logoPanel: true` in
  `src/config/company.js`, which puts a white panel behind it.
- If the logo already contains the company name, set `logoIncludesName: true` so the name isn't shown twice.
