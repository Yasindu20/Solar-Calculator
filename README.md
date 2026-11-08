# Solar savings calculator — Ceylon Energy & Engineering Services

A React (Vite) website that works out what a rooftop solar system saves and earns, how soon it pays for itself, and
downloads a branded one-page PDF report for the customer.

It has two calculators, picked with the two cards at the top of the page. Each is named by what the customer's bill
looks like, so choosing one needs no explaining:

| Calculator | For | Link |
| --- | --- | --- |
| **Standard bill** | Homes and small shops. The bill shows one total of units. | `/` |
| **Time-of-use bill** | Factories, hotels and offices. The bill shows Day, Peak and Off-peak units and a kVA charge (GP-2, I-2 and similar). Works out solar, battery storage (BESS) and the investment returns. | `/#time-of-use` |

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

The figures are typed straight from the customer's bill, in the bill's own order and wording. One table holds every
charge: Day, Peak, Off-peak, Max demand, Fixed charge and Export (only when solar is already installed), each with its
rate box beside its units box. The calculator rebuilds the bill line by line, then shows what solar takes off it.

### How the bill is worked out

These rules reproduce real EDL (formerly CEB) and LECO bills to the cent — see `tests/bills.test.js`.

| Line | Rule |
| --- | --- |
| Units | as printed on the bill (the units charged, after any "Multiplied by") |
| Day units billed | Day units − Export units (export from solar already on the roof is set off against Day units only) |
| Day, Peak, Off-peak charges | units × rate, each rounded to the cent |
| Max demand | the month's kVA reading × rate per kVA (it is a reading, not a difference) |
| Fixed charge | as on the bill |
| SSC Levy | charges × 2.5 ÷ 97.5, which makes it 2.5% of the total |
| Monthly bill | charges + SSC Levy |

### Worked out as you type

- **Day units billed** after export, **night-time units** (Peak + Off-peak, which solar can't cover) and the
  **total units** for the month.
- **Rates** fill in from the tariff picked, beside the units they apply to; any rate can be changed to match the bill,
  with a link back to the tariff rates.
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

### With a battery (BESS)

**Add a battery** switches on a third bill: today, with solar, and with solar and a battery. The battery runs one charge
and one discharge a day, and every unit it handles is counted once:

| Rule | How it works |
| --- | --- |
| Units out | units put in × round-trip efficiency (88%), up to the usable capacity (90% of the kWh) a day |
| Power | the inverter (PCS) kW × the hours available: 4 peak hours to discharge, 7 off-peak hours or 6 solar hours to charge |
| Charging cost | grid units overnight cost the Off-peak rate; solar put into the battery no longer replaces Day units (costs the Day rate) or, if it was surplus, loses its export payment |
| Where units go | each unit goes where it saves most (Peak before Off-peak), from the cheapest source, and only when it saves more than it costs |
| Grid charging | only serves the next evening's peak, never Off-peak use |
| Max demand | counted only when the kVA reduction is entered **and** ticked as confirmed from half-hourly load data, and never more than the inverter kW |

How the battery is used: **Smart** (the most profitable mix, recommended), **Peak hours**, **Off-peak hours** (only when
it pays: storing a unit must cost less than the Off-peak unit it replaces) or **Max demand**. It can charge from solar
and grid, solar only or grid only. The page suggests a size that covers the daily peak use (usable kWh and inverter kW),
warns when overnight charging could set a new maximum demand, and shows how the battery runs through the day.

The saving is itemised: Day units replaced by solar, Peak and Off-peak units replaced by the battery, the max-demand
saving (or why it isn't counted) and the charging cost, all with the SSC Levy.

### Investment and returns

| Figure | Formula |
| --- | --- |
| Total investment | solar cost + battery cost + other costs |
| Annual net saving | yearly savings − maintenance (− the battery replacement in its year) |
| Simple payback | total investment ÷ first-year net saving |
| Payback (headline and chart) | when the running total of annual net savings passes the investment |
| Annual return | first-year net saving ÷ total investment |
| Net present value | each year's net saving discounted at 10% a year, less the investment |

Each year the panel saving falls 0.5% and the battery saving 2%; maintenance is 1% of the investment a year; the battery
is replaced after 10 years at 60% of today's price, which shows as a dip in the 20-year cash chart. The page also shows
the position after 5, 10, 15 and 20 years.

**Engineering mode** (switch at the top of the form) shows the settings to change after a site survey: usable capacity,
efficiency, a daily discharge limit, cycles a month, other costs, maintenance, panel and battery ageing, battery life and
replacement cost, and the discount rate.

The PDF report has two pages: the bill today, with solar and with a battery line by line, the itemised saving and how
the battery runs each day; then the investment, the cash chart, the year-by-year table and what the figures assume.

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
| Battery price per kWh, usable capacity, efficiency, cycles a month | `batteryDefaults` in `src/config/tariffs.js` |
| Maintenance, ageing, battery life and replacement, discount rate | `financeDefaults` in `src/config/tariffs.js` |
| PDF layout | `src/lib/pdf/drawReport.js` |

**When the PUCSL revises tariffs**, update the rates and the `effective` date in `src/config/tariffs.js`. GP-3 and I-3
are listed with `rates: null` until their rates are confirmed: picking one leaves the rate boxes empty to be typed from
the bill. Another tariff (H-2 and so on) can be added as one more entry; until then, "Another tariff" works the same way.

**Set the battery price.** `batteryDefaults.pricePerKwh` (Rs. 70,000 per kWh, installed with its inverter) is a
placeholder estimate. The battery cost on the page starts from it, so set it to your supplier's price.

Phone and email are blank for now; anything you fill in appears in the website footer and the PDF footer.

## How the PDF is made

The report is drawn with [jsPDF](https://github.com/parallax/jsPDF) in the browser, so no server is needed. jsPDF and
the report fonts (Barlow, SIL Open Font License, see `src/assets/fonts/OFL.txt`) only download when someone clicks
**Download PDF report**, which keeps the page itself light.
