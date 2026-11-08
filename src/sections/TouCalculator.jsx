import { useMemo, useRef } from 'react';
import { findTariff } from '../config/tariffs.js';
import { toNumber } from '../lib/calc.js';
import {
  calculateTou,
  tariffRateFields,
  blankRates,
  touDefaultInputs,
  clearedBillInputs,
  generationFromSize,
  estimateBatteryCost,
  isBlank,
  benefitNoun,
} from '../lib/touCalc.js';
import { formatTyped, rs, percent } from '../lib/format.js';
import { useInView, useReportDownload } from '../lib/hooks.js';
import { NumberField, TextField } from '../components/NumberField.jsx';
import { ResultPanel, MobileBar } from '../components/ResultPanel.jsx';
import { CleanEnergy } from '../components/Details.jsx';
import { ChargesTable, UnitsSummary } from '../components/tou/ChargesTable.jsx';
import { TariffField, RatesNote, SsclCheck, BillCheck } from '../components/tou/BillFields.jsx';
import { SolarFields } from '../components/tou/SolarFields.jsx';
import { BatteryFields } from '../components/tou/BatteryFields.jsx';
import { InvestmentFields } from '../components/tou/InvestmentFields.jsx';
import { Toggle } from '../components/tou/Choices.jsx';
import { BillTable, SavingsBreakdown, UnitsByTime, Returns } from '../components/tou/BillDetails.jsx';
import { BatteryFlow } from '../components/tou/BatteryFlow.jsx';
import { CashBlock } from './StandardCalculator.jsx';

// Today's bill, the bill with solar, and with solar and a battery, with the cut each one makes.
function BillsSummary({ r }) {
  const cut = (total) => (r.today.total > 0 ? Math.round(((r.today.total - total) / r.today.total) * 100) : 0);
  const rows = [
    { key: 'today', label: 'Bill today', total: r.today.total },
    { key: 'solar', label: r.netPlus ? 'With solar (Net Plus)' : 'With solar', total: r.withSolar.total },
  ];
  if (r.battery.on) rows.push({ key: 'battery', label: 'With solar + battery', total: r.withBattery.total });
  return (
    <dl className="result-bills">
      {rows.map((row, i) => {
        const c = cut(row.total);
        return (
          <div key={row.key} className={i === rows.length - 1 && i > 0 ? 'is-last' : undefined}>
            <dt>{row.label}</dt>
            <dd>
              {rs(row.total)}
              {row.key !== 'today' && <span className="result-cut">{c > 0 ? `−${c}%` : 'no change'}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// Section 2: bills that charge Day, Peak and Off-peak units and a max-demand (kVA) charge,
// with solar, an optional battery (BESS) and the investment it all takes.
export function TouCalculator({ values, setValues }) {
  const results = useMemo(() => calculateTou(values), [values]);
  const panelRef = useRef(null);
  const panelInView = useInView(panelRef);
  const r = results;
  const tariff = findTariff(values.tariff);

  const { download, busy, failed } = useReportDownload(() => ({
    kind: 'tou',
    results,
    details: {
      customerName: values.customerName,
      location: values.location,
      systemSize: values.systemSize,
      tariff: tariff ? tariff.id : '',
      existingSolar: values.existingSolar,
    },
  }));

  const update = (fn) => setValues((prev) => ({ ...prev, ...fn(prev) }));
  const set = (name) => (value) => update(() => ({ [name]: value }));
  const setIn = (group) => (key) => (value) => update((prev) => ({ [group]: { ...prev[group], [key]: value } }));
  const onUnits = setIn('units');
  const onRate = setIn('rates');
  const setBattery = setIn('battery');
  const setCost = setIn('costs');
  const setFinance = setIn('finance');

  const chooseTariff = (id) => update(() => ({ tariff: id, rates: tariffRateFields(id) ?? blankRates() }));
  const restoreRates = () => update((prev) => ({ rates: tariffRateFields(prev.tariff) ?? prev.rates }));

  // A new size re-estimates what follows from it; refocusing the same size leaves typed figures alone.
  const sizeChanged = (value, before) => toNumber(value) !== toNumber(before) || isBlank(value) !== isBlank(before);
  const onSize = (value) =>
    update((prev) => {
      if (!sizeChanged(value, prev.systemSize) || isBlank(value)) return { systemSize: value };
      return { systemSize: value, generation: formatTyped(generationFromSize(toNumber(value)), 0) };
    });
  const onCapacity = (value) =>
    update((prev) => {
      const battery = { ...prev.battery, capacity: value };
      if (!sizeChanged(value, prev.battery.capacity) || isBlank(value)) return { battery };
      return { battery, costs: { ...prev.costs, battery: formatTyped(estimateBatteryCost(toNumber(value)), 0) } };
    });
  const onUseRecommended = ({ kwh, kw }) =>
    update((prev) => ({
      battery: { ...prev.battery, capacity: formatTyped(kwh, 'auto'), power: formatTyped(kw, 'auto') },
      costs: { ...prev.costs, battery: formatTyped(estimateBatteryCost(kwh), 0) },
    }));

  const noun = benefitNoun(r);
  // Nothing typed from the bill yet (for example after "Clear for a new bill").
  const billEmpty = r.totalUnits === 0 && r.exported === 0 && r.maxDemand === 0;

  return (
    <>
      <div className="workspace workspace-tou">
        <form className="inputs" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="form-note">
            <p>Copy the figures from the customer’s bill. Everything else is worked out as you type.</p>
            <button type="button" className="link-button" onClick={() => setValues(clearedBillInputs)}>
              Clear for a new bill
            </button>
            <div className="form-note-mode">
              <Toggle
                checked={values.engineering}
                onChange={set('engineering')}
                label="Engineering mode"
                hint="Battery, maintenance and ageing settings for site surveys"
              />
            </div>
          </div>

          <fieldset>
            <legend>The bill</legend>
            <TariffField value={values.tariff} onChange={chooseTariff} />
            <RatesNote values={values} onRestore={restoreRates} />
            <ChargesTable values={values} onRate={onRate} onUnits={onUnits} onMaxDemand={set('maxDemand')} />
            <UnitsSummary results={r} />
            <SsclCheck checked={values.sscl} onChange={set('sscl')} />
            <BillCheck value={values.billTotal} onChange={set('billTotal')} results={r} />
          </fieldset>

          <fieldset>
            <legend>Solar system</legend>
            <SolarFields values={values} results={r} set={set} onSize={onSize} />
          </fieldset>

          <fieldset>
            <legend>Battery storage</legend>
            <BatteryFields values={values} results={r} setBattery={setBattery} onCapacity={onCapacity} onUseRecommended={onUseRecommended} />
          </fieldset>

          <fieldset>
            <legend>Investment</legend>
            <InvestmentFields values={values} results={r} setCost={setCost} setFinance={setFinance} />
          </fieldset>

          <fieldset>
            <legend>On the report</legend>
            <div className="field-pair">
              <TextField label="Prepared for" optional placeholder="Customer name" value={values.customerName} onChange={set('customerName')} />
              <TextField label="Location" optional placeholder="e.g. Moratuwa" value={values.location} onChange={set('location')} />
            </div>
            {values.engineering && (
              <NumberField
                label="Solar already on site"
                optional
                suffix="kWp"
                decimals="auto"
                value={values.existingSolar}
                onChange={set('existingSolar')}
                hint="Shown on the report. Its export goes in the bill table."
              />
            )}
          </fieldset>

          <button type="button" className="reset" onClick={() => setValues(touDefaultInputs())}>
            Reset to example figures
          </button>
        </form>

        <ResultPanel
          results={r}
          figures={[
            { label: `Monthly ${noun}`, value: billEmpty ? '—' : rs(r.totalMonthlyIncome) },
            { label: 'Annual return', value: r.hasCost && !billEmpty ? percent(r.roi) : '—' },
            { label: `${r.years}-year net gain`, value: billEmpty ? '—' : rs(r.netGain) },
          ]}
          noBenefitNote="There’s no saving with these figures. Check the units, the solar system and the battery."
          empty={billEmpty ? { headline: 'Enter the bill figures', note: 'Type the units from the bill to see the saving.' } : null}
          onDownload={download}
          busy={busy}
          failed={failed}
          panelRef={panelRef}
        >
          <BillsSummary r={r} />
        </ResultPanel>
      </div>

      <section className="sheet" aria-label="Detailed results">
        <div className="sheet-row sheet-row-tou">
          <div className="sheet-block">
            <h2>The bill, line by line</h2>
            <BillTable results={r} />
          </div>
          <div className="sheet-block">
            <h2>Your monthly {noun}</h2>
            <SavingsBreakdown results={r} noun={noun} />
          </div>
        </div>

        {r.battery.on ? (
          <div className="sheet-row">
            <div className="sheet-block">
              <h2>Units by time of day</h2>
              <UnitsByTime results={r} />
            </div>
            <div className="sheet-block">
              <h2>How the battery works</h2>
              <BatteryFlow results={r} />
            </div>
          </div>
        ) : (
          <div className="sheet-block">
            <h2>Units by time of day</h2>
            <UnitsByTime results={r} />
          </div>
        )}

        <div className="sheet-block">
          <h2>Investment and returns</h2>
          <Returns results={r} />
          <CleanEnergy results={r} />
        </div>

        <CashBlock results={r} />
      </section>

      <MobileBar results={r} visible={!panelInView} onDownload={download} busy={busy} emptyText={billEmpty ? 'Enter the bill' : null} />
    </>
  );
}
