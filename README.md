# Solar savings calculator — Ceylon Energy & Engineering Services

A React (Vite) website that works out what a rooftop solar system saves and earns, how soon it pays for itself, and
downloads a branded one-page PDF report for the customer.

It has two calculators, picked with the two cards at the top of the page. Each is named by what the customer's bill
looks like, so choosing one needs no explaining:

| Calculator | For | Link |
| --- | --- | --- |
| **Standard bill** | Homes and small shops. The bill shows one total of units. | `/` |
| **Time-of-use bill** | Factories, hotels and offices. The bill shows Day, Peak and Off-peak units and a kVA charge (GP-2, I-2 and similar). | `/#time-of-use` |

Each calculator keeps its figures while the other one is open.

## Standard bill

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

## Time-of-use bill

The figures are typed straight from the customer's bill, in the bill's own order and wording. The calculator rebuilds
the bill line by line, then shows what solar takes off it.

### How the bill is worked out

These rules reproduce real EDL (formerly CEB) and LECO bills to the cent — see `tests/bills.test.js`.

| Line | Rule |
| --- | --- |
| Units on a register | (current reading − previous reading) × meter multiplier |
| Day units billed | Day units − Export units (export from solar already on the roof is set off against Day units only) |
| Day, Peak, Off-peak charges | units × rate, each rounded to the cent |
| Max demand | the month's kVA reading × rate per kVA (it is a reading, not a difference) |
| Fixed charge | as on the bill |
| SSC Levy | charges × 2.5 ÷ 97.5, which makes it 2.5% of the total |
| Monthly bill | charges + SSC Levy |

### Worked out as you type

- **Units** from each pair of meter readings (or type the units directly with **Units only**).
- **Day units billed** after export, **night-time units** (Peak + Off-peak, which solar can't cover) and the
  **total units** for the month.
- **Rates** fill in from the tariff picked; any rate can be changed to match the bill, with a link back to the tariff
  rates.
- **Check against the bill** (optional): type the bill's total and the calculator confirms it matches, or says by how
  much it differs and what to check. A bill split into two consumption periods (a tariff change mid-month) is flagged
  this way, because the calculator prices the whole month at one set of rates.
- **Generation** from the system size (120 units per kWp a month, editable), and a suggested size that covers every
  Day unit, applied with one click.
- **What solar covers**: Day units replaced, Day and night-time units still bought from the grid, or any surplus sold.

### With solar

| How the solar is used | Bill with solar | Monthly benefit |
| --- | --- | --- |
| **Cut the bill** | Day units reduced by generation (never below zero); Peak, Off-peak, max demand and the fixed charge unchanged; levy recalculated | bill saved + surplus units × payment per surplus unit |
| **Sell it all (Net Plus)** | unchanged | generation × payment per unit sold |

Payback, annual return, the 20-year cash position and the clean-energy estimate are worked out the same way as in the
standard calculator (`projection()` in `src/lib/calc.js`). The PDF report shows the bill today and with solar line by
line.

## Run it on your computer

Needs Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

To check the calculations against the real bills:

```bash
npm test
```

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
| Opening figures, 20-year outlook, CO₂ factor | `src/config/company.js` (`touExample` for the time-of-use calculator) |
| Time-of-use tariff rates (GP-2, I-2), SSC Levy, units per kWp, surplus payment rate | `src/config/tariffs.js` |
| PDF layout | `src/lib/pdf/drawReport.js` |

**When the PUCSL revises tariffs**, update the rates and the `effective` date in `src/config/tariffs.js`. Another
tariff (H-2, GP-3, I-3 and so on) can be added there as one more entry; until then, "Another tariff" lets the rates be
typed from the bill.

Phone and email are blank for now; anything you fill in appears in the website footer and the PDF footer.

## How the PDF is made

The report is drawn with [jsPDF](https://github.com/parallax/jsPDF) in the browser, so no server is needed. jsPDF and
the report fonts (Barlow, SIL Open Font License, see `src/assets/fonts/OFL.txt`) only download when someone clicks
**Download PDF report**, which keeps the page itself light.
