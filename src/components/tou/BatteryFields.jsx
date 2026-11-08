import { touPeriods, periodHours } from '../../config/tariffs.js';
import { qty, rs, rsRate, units } from '../../lib/format.js';
import { NumberField } from '../NumberField.jsx';
import { ChoiceCards, Segmented, Toggle } from './Choices.jsx';

const MODES = [
  { value: 'smart', title: 'Smart', badge: 'Recommended', text: 'The most profitable mix: each unit goes where it saves most.' },
  { value: 'peak', title: 'Peak hours', text: `Replaces Peak units, ${touPeriods.peak.window}.` },
  { value: 'offPeak', title: 'Off-peak hours', text: `Replaces Off-peak units, ${touPeriods.offPeak.window}, when it pays.` },
  { value: 'demand', title: 'Max demand', text: 'Holds down the kVA reading. Counted once load data confirms it.' },
];

const CHARGING = [
  { value: 'both', label: 'Solar and grid' },
  { value: 'solar', label: 'Solar only' },
  { value: 'grid', label: 'Grid only' },
];

function BatteryIcon() {
  return (
    <svg className="advice-icon advice-icon-battery" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="16" height="10" rx="2" />
      <path d="M21 10.5v3" />
      <rect className="advice-icon-fill" x="5.5" y="9.5" width="7" height="5" rx="1" />
    </svg>
  );
}

const LIMITS = {
  capacity: (b) => `Its ${qty(Math.round(b.plan.usableKwh))} kWh of usable capacity is the limit.`,
  power: (b) => `The ${qty(b.power)} kW inverter is the limit over the ${periodHours.peak} peak hours.`,
  charging: (b) =>
    b.charging === 'solar' ? 'There isn’t enough solar to fill it; allowing grid charging would.' : 'There isn’t enough energy to fill it.',
  cost: () => 'Charging any more would cost more than it saves.',
  dailyLimit: () => 'The daily discharge limit holds it back.',
};

// What the battery does each day, worked out as the figures are typed.
function BatteryAdvice({ r, onUseRecommended }) {
  const b = r.battery;
  const p = b.plan;
  const d = p.perDay;
  const rec = b.recommended;
  const solarIn = d.surplus + d.daySolar;
  const offersRecommendation = rec && b.mode !== 'demand' && (rec.kwh !== b.capacity || rec.kw !== b.power);
  const recommend = offersRecommendation ? (
    <>
      {' '}
      About {qty(rec.kwh)} kWh with a {qty(rec.kw)} kW inverter would cover the {qty(Math.round(rec.daily))} kWh of daily{' '}
      {b.mode === 'offPeak' ? 'Off-peak' : 'peak'} use.{' '}
      <button type="button" className="link-button" onClick={() => onUseRecommended(rec)}>
        Use {qty(rec.kwh)} kWh and {qty(rec.kw)} kW
      </button>
    </>
  ) : null;

  let body;
  if (b.mode === 'demand') {
    body = (
      <p>
        The battery is held for the site’s demand peaks instead of the evening peak. It saves money only once half-hourly load
        data confirms how far it holds the kVA reading down.
      </p>
    );
  } else if (p.delivered > 0) {
    const out = [];
    const kwh = (n) => `${qty(Math.round(n))} kWh`;
    if (d.peak > 0) out.push(`${kwh(d.peak)} in the evening peak`);
    if (d.offPeak > 0) out.push(`${kwh(d.offPeak)} overnight`);
    const into = [];
    if (d.grid > 0) into.push(`${kwh(d.grid)} from the grid overnight`);
    if (solarIn > 0) into.push(`${kwh(solarIn)} of solar`);
    const limit = p.limit && p.limit !== 'usage' ? ` ${LIMITS[p.limit](b)}` : '';
    body = (
      <p>
        Each day the battery supplies {out.join(' and ')}, charged with {into.join(' and ')}. That replaces{' '}
        {units(p.delivered)} a month{p.limit === 'usage' ? ': all of the peak use.' : '.'}
        {limit}
        {b.mode !== 'offPeak' && p.notWorthIt.offPeak && ' Off-peak use isn’t worth it at these rates.'}
        {p.limit !== 'usage' && recommend}
      </p>
    );
  } else if (b.mode === 'offPeak' && b.charging === 'grid') {
    body = <p>Grid charging happens overnight, so it can’t replace Off-peak units. Charge from solar instead.</p>;
  } else if (b.mode === 'offPeak' && p.notWorthIt.offPeak) {
    body = (
      <p>
        Off-peak use doesn’t pay here: a stored unit costs more than the {rsRate(r.rates.offPeak)} Off-peak unit it replaces.
        Smart or Peak hours will do better.
      </p>
    );
  } else if (b.charging === 'solar' && r.generation <= 0 && r.exported <= 0) {
    body = <p>There’s no solar to charge it from. Add a solar system or allow grid charging.</p>;
  } else {
    body = <p>With these figures the battery can’t save anything.{recommend}</p>;
  }

  return (
    <div className="advice advice-battery" aria-live="polite">
      <BatteryIcon />
      <div>
        {body}
        {b.nightDemandRisk && (
          <p className="advice-warning">
            Charging overnight adds about {qty(Math.round(b.nightChargeKw))} kW. With the night load that’s around{' '}
            {qty(Math.round(b.nightKva))} kVA, close to the {qty(r.maxDemand)} kVA maximum demand. Spread charging across the
            off-peak hours, or the kVA charge could rise.
          </p>
        )}
      </div>
    </div>
  );
}

function DemandFields({ values, r, setBattery }) {
  const b = r.battery;
  let status = null;
  if (b.demandCounted > 0) {
    status = (
      <p className="bill-check is-match">
        Counted: {rs(b.demandPossibleSaving)} a month off the max-demand charge ({qty(b.demandCounted)} kVA ×{' '}
        {rsRate(r.rates.demand)}, with the levy).
      </p>
    );
  } else if (b.demandPossible > 0) {
    status = (
      <div className="bill-check is-off">
        <p>Not counted yet.</p>
        <p className="bill-check-help">
          A {qty(b.demandPossible)} kVA cut would save about {rs(b.demandPossibleSaving)} a month, but only half-hourly load data
          shows whether the battery can hold the demand down. Tick the box once it does.
        </p>
      </div>
    );
  }
  const capped = b.mdReduction > b.demandPossible && b.demandPossible > 0;
  return (
    <div className="demand-box">
      <NumberField
        label="Max-demand reduction"
        optional
        suffix="kVA"
        decimals="auto"
        value={values.battery.mdReduction}
        onChange={setBattery('mdReduction')}
        hint={capped ? `Limited to the ${qty(b.power)} kW inverter.` : 'How far the battery holds down the highest demand'}
      />
      <label className="check">
        <input type="checkbox" checked={values.battery.mdVerified} onChange={(e) => setBattery('mdVerified')(e.target.checked)} />
        <span>
          Confirmed from half-hourly load data
          <small>Only then is the max-demand saving counted</small>
        </span>
      </label>
      <div aria-live="polite">{status}</div>
    </div>
  );
}

export function BatteryFields({ values, results: r, setBattery, onCapacity, onUseRecommended }) {
  const b = r.battery;
  const on = values.battery.on;
  return (
    <>
      <Toggle
        checked={on}
        onChange={setBattery('on')}
        label="Add a battery (BESS)"
        hint="Stores cheap energy and uses it when grid units cost the most"
      />
      {on && (
        <>
          <div className="field-pair field-pair-even">
            <NumberField
              label="Battery capacity"
              suffix="kWh"
              decimals="auto"
              value={values.battery.capacity}
              onChange={onCapacity}
              hint={b.on ? `${qty(Math.round(b.plan.usableKwh))} kWh usable each day` : 'Nameplate energy'}
            />
            <NumberField
              label="Inverter (PCS) power"
              suffix="kW"
              decimals="auto"
              value={values.battery.power}
              onChange={setBattery('power')}
              hint={b.power > 0 ? `Up to ${qty(b.power * periodHours.peak)} kWh over the peak hours` : 'Charge and discharge power'}
            />
          </div>

          {b.on && <BatteryAdvice r={r} onUseRecommended={onUseRecommended} />}

          <ChoiceCards label="How the battery is used" options={MODES} value={values.battery.mode} onChange={setBattery('mode')} />
          <Segmented label="Charge it from" options={CHARGING} value={values.battery.charging} onChange={setBattery('charging')} />

          {(values.battery.mode === 'smart' || values.battery.mode === 'demand') && (
            <DemandFields values={values} r={r} setBattery={setBattery} />
          )}

          {values.engineering && (
            <div className="engineering">
              <p className="engineering-title">Battery settings</p>
              <div className="field-pair field-pair-even">
                <NumberField label="Usable capacity" suffix="%" decimals="auto" value={values.battery.usable} onChange={setBattery('usable')} hint="Depth of discharge" />
                <NumberField label="Round-trip efficiency" suffix="%" decimals="auto" value={values.battery.efficiency} onChange={setBattery('efficiency')} hint="Units out ÷ units in" />
              </div>
              <div className="field-pair field-pair-even">
                <NumberField
                  label="Daily discharge limit"
                  optional
                  suffix="kWh"
                  decimals="auto"
                  value={values.battery.dailyLimit}
                  onChange={setBattery('dailyLimit')}
                  hint="Cap from the site survey"
                />
                <NumberField label="Cycles a month" decimals="auto" value={values.battery.days} onChange={setBattery('days')} hint="One charge and discharge a day" />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
