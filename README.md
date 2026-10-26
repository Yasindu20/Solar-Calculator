# Solar savings calculator — Ceylon Energy & Engineering Services

A React (Vite) website that works out what a rooftop solar system saves and earns, how soon it pays for itself, and
downloads a branded one-page PDF report for the customer.

The calculation is the same as the previous calculator:

| Figure | Formula |
| --- | --- |
| Unit balance | monthly generation − monthly usage |
| Export income | unit balance × payment per surplus unit |
| Monthly benefit | electricity bill + export income |
| 1 / 10 / 20-year income | monthly benefit × 12 / 120 / 240 |
| Annual return | 1-year income ÷ system cost |
| Payback | system cost ÷ monthly benefit |

One fix: a payback such as 35.6 months now shows as "3 years" instead of "2 years 12 months".

## Run it on your computer

Needs Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

## Deploy to Vercel

**From GitHub (recommended)**

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically (build command `npm run build`, output folder `dist`). Click **Deploy**.

Every push to the main branch redeploys the site.

**From the command line**

```bash
npm install -g vercel
vercel          # first time: answer the prompts, accept the detected Vite settings
vercel --prod   # publish to the live URL
```

## Changing things

| What | Where |
| --- | --- |
| Company name, address, website, phone, email | `src/config/company.js` |
| Colours (website and PDF together) | `src/config/brand.js` |
| Logo | Drop `logo.png` or `logo.svg` into `src/assets/brand/` |
| Opening figures, 20-year outlook, CO₂ factor | `src/config/company.js` |
| PDF layout | `src/lib/pdf/drawReport.js` |

Phone and email are blank for now; anything you fill in appears in the website footer and the PDF footer.

## How the PDF is made

The report is drawn with [jsPDF](https://github.com/parallax/jsPDF) in the browser, so no server is needed. jsPDF and
the report fonts (Barlow, SIL Open Font License, see `src/assets/fonts/OFL.txt`) only download when someone clicks
**Download PDF report**, which keeps the page itself light.
