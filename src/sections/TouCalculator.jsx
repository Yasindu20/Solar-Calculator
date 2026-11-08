import { useMemo, useRef } from 'react';
import { findTariff } from '../config/tariffs.js';
import { toNumber } from '../lib/calc.js';
import {
  calculateTou,
  tariffRateFields,
  touDefaultInputs,
  clearedBillInputs,
  generationFromSize,
  isBlank,
  benefitNoun,
  REGISTERS,
} from '../lib/touCalc.js';
import { formatTyped, rs, percent } from '../lib/format.js';
import { useInView, useReportDownload } from '../lib/hooks.js';
import { NumberField, TextField } from '../components/NumberField.jsx';
import { ResultPanel, MobileBar } from '../components/ResultPanel.jsx';
import { IncomeTotals, CleanEnergy } from '../components/Details.jsx';
import { EntrySwitch, MeterTable, MeterSummary } from '../components/tou/MeterReadings.jsx';
import { TariffField, RateFields, BillCheck } from '../components/tou/RateFields.jsx';
import { SolarFields } from '../components/tou/SolarFields.jsx';
import { BillTable, TouBenefit, UnitsByTime } from '../components/tou/BillDetails.jsx';
import { CashBlock } from './StandardCalculator.jsx';

// Section 2: bills that charge Day, Peak and Off-peak units and a max-demand (kVA) charge.
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
    },
  }));

  const update = (fn) => setValues((prev) => ({ ...prev, ...fn(prev) }));
  const set = (name) => (value) => update(() => ({ [name]: value }));
  const onReading = (key, which) => (value) =>
    update((prev) => ({ readings: { ...prev.readings, [key]: { ...prev.readings[key], [which]: value } } }));
  const onUnits = (key) => (value) => update((prev) => ({ units: { ...prev.units, [key]: value } }));
  const onRate = (key) => (value) => update((prev) => ({ rates: { ...prev.rates, [key]: value } }));

  const chooseTariff = (id) => update((prev) => ({ tariff: id, rates: tariffRateFields(id) ?? prev.rates }));
  const restoreRates = () => update((prev) => ({ rates: tariffRateFields(prev.tariff) ?? prev.rates }));

  // A new size re-estimates generation; refocusing the same size leaves a typed generation alone.
  const onSize = (value) =>
    update((prev) => {
      const changed = toNumber(value) !== toNumber(prev.systemSize) || isBlank(value) !== isBlank(prev.systemSize);
      if (!changed || isBlank(value)) return { systemSize: value };
      return { systemSize: value, generation: formatTyped(generationFromSize(toNumber(value)), 0) };
    });

  // Switching to "Units only" carries the units worked out from the readings across.
  const switchEntry = (entry) =>
    update((prev) => {
      if (prev.entry === entry) return {};
      if (entry === 'readings') return { entry };
      const worked = calculateTou(prev).registers;
      const unitsFields = Object.fromEntries(
        REGISTERS.map((key) => [key, worked[key].status === 'ok' ? formatTyped(worked[key].units, 'auto') : prev.units[key]]),
      );
      return { entry, units: unitsFields };
    });

  const noun = benefitNoun(r);
  const monthlyLabel = `Monthly ${noun}`;
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
          </div>

          <fieldset>
            <legend>The bill</legend>
            <TariffField value={values.tariff} onChange={chooseTariff} />
          </fieldset>

          <fieldset>
            <legend>Meter readings</legend>
            <EntrySwitch value={values.entry} onChange={switchEntry} />
            <MeterTable values={values} results={r} onReading={onReading} onUnits={onUnits} />
            <MeterSummary results={r} />
            <div className={values.entry === 'readings' ? 'field-pair field-pair-even' : undefined}>
              <NumberField
                label="Max demand"
                suffix="kVA"
                decimals="auto"
                value={values.maxDemand}
                onChange={set('maxDemand')}
                hint="This month’s kVA reading on the bill"
              />
              {values.entry === 'readings' && (
                <NumberField
                  label="Meter multiplier"
                  decimals="auto"
                  value={values.multiplier}
                  onChange={set('multiplier')}
                  hint="“Multiplied by” on CEB/EDL bills. Usually 1."
                />
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Rates</legend>
            <RateFields values={values} onRate={onRate} onRestore={restoreRates} onSscl={set('sscl')} />
            <BillCheck value={values.billTotal} onChange={set('billTotal')} results={r} />
          </fieldset>

          <fieldset>
            <legend>Solar system</legend>
            <SolarFields values={values} results={r} set={set} onSize={onSize} />
          </fieldset>

          <fieldset>
            <legend>On the report</legend>
            <div className="field-pair">
              <TextField label="Prepared for" optional placeholder="Customer name" value={values.customerName} onChange={set('customerName')} />
              <TextField label="Location" optional placeholder="e.g. Moratuwa" value={values.location} onChange={set('location')} />
            </div>
          </fieldset>

          <button type="button" className="reset" onClick={() => setValues(touDefaultInputs())}>
            Reset to example figures
          </button>
        </form>

        <ResultPanel
          results={r}
          figures={[
            { label: monthlyLabel, value: billEmpty ? '—' : rs(r.totalMonthlyIncome) },
            { label: 'Annual return', value: r.hasCost && !billEmpty ? percent(r.roi) : '—' },
            { label: `${r.years}-year net gain`, value: billEmpty ? '—' : rs(r.netGain) },
          ]}
          noBenefitNote="There’s no saving with these figures. Check the readings and the solar system."
          empty={billEmpty ? { headline: 'Enter the bill figures', note: 'Type the meter readings or units from the bill to see the saving.' } : null}
          onDownload={download}
          busy={busy}
          failed={failed}
          panelRef={panelRef}
        >
          <div className={`result-bill${r.billSaving > 0 ? '' : ' is-unchanged'}`}>
            <div>
              <span>Bill today</span>
              <strong>{rs(r.today.total)}</strong>
            </div>
            <svg className="result-bill-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />
            </svg>
            <div>
              <span>{r.netPlus ? 'With Net Plus' : 'With solar'}</span>
              <strong>{rs(r.withSolar.total)}</strong>
            </div>
          </div>
        </ResultPanel>
      </div>

      <section className="sheet" aria-label="Detailed results">
        <div className="sheet-row sheet-row-tou">
          <div className="sheet-block">
            <h2>The bill, line by line</h2>
            <BillTable results={r} />
          </div>
          <div className="sheet-block">
            <h2>Units by time of day</h2>
            <UnitsByTime results={r} />
            <h2 className="sheet-subhead">Your monthly {noun}</h2>
            <TouBenefit results={r} noun={noun} />
          </div>
        </div>

        <CashBlock results={r} />

        <div className="sheet-block">
          <h2>{noun === 'income' ? 'Income' : noun === 'saving' ? 'Savings' : 'Benefit'} over time</h2>
          <IncomeTotals results={r} noun={noun} />
          <CleanEnergy results={r} />
        </div>
      </section>

      <MobileBar results={r} visible={!panelInView} onDownload={download} busy={busy} emptyText={billEmpty ? 'Enter the bill' : null} />
    </>
  );
}
