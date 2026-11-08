// The battery's day in four moments, with the energy flows that run for this customer.
// Shared by the "How the battery works" diagram on the page and the PDF report.
import { touPeriods } from '../config/tariffs.js';
import { qty } from './format.js';

const kwh = (n) => `${qty(Math.round(n))} kWh`;

export function batteryStory(r) {
  const b = r.battery;
  const d = b.plan.perDay;
  const solarIn = d.surplus + d.daySolar;
  const solarOnSite = !r.netPlus && r.solarToDay - b.plan.charge.daySolar > 0.5;
  const peakShare = r.peakUnits > 0 ? Math.round((b.plan.peak / r.peakUnits) * 100) : 0;

  let dayText = 'The grid runs the site.';
  if (r.netPlus) dayText = 'Solar is sold under Net Plus; the grid runs the site.';
  else if (solarIn > 0) dayText = `Solar runs the site and puts ${kwh(solarIn)} a day into the battery.`;
  else if (solarOnSite) dayText = d.grid > 0 ? 'Solar runs the site. The battery is charged overnight instead, which costs less.' : 'Solar runs the site.';

  const night = [];
  if (d.grid > 0) night.push(`The grid charges the battery with ${kwh(d.grid)} at the Off-peak rate.`);
  if (d.offPeak > 0) night.push(`The battery supplies ${kwh(d.offPeak)} of night use.`);

  let demandText = 'Not counted: cutting demand spikes needs half-hourly load data.';
  if (b.demandCounted > 0) demandText = `The battery covers short spikes, holding the maximum demand ${qty(b.demandCounted)} kVA lower.`;
  else if (b.demandPossible > 0) demandText = 'Could cover short spikes; counted once load data confirms it.';

  return [
    {
      key: 'day',
      title: touPeriods.day.label,
      when: touPeriods.day.window,
      flows: [
        { from: 'sun', to: 'site', on: solarOnSite },
        { from: 'sun', to: 'battery', on: solarIn > 0 },
        { from: 'grid', to: 'site', on: r.withBattery.lines.day.quantity > 0.5 },
      ],
      text: dayText,
    },
    {
      key: 'peak',
      title: touPeriods.peak.label,
      when: touPeriods.peak.window,
      flows: [
        { from: 'battery', to: 'site', on: d.peak > 0 },
        { from: 'grid', to: 'site', on: r.peakUnits - b.plan.peak > 0.5 },
      ],
      text: d.peak > 0 ? `The battery supplies ${kwh(d.peak)} a day: ${peakShare}% of Peak units.` : 'The grid supplies the evening peak.',
    },
    {
      key: 'offPeak',
      title: touPeriods.offPeak.label,
      when: touPeriods.offPeak.window,
      flows: [
        { from: 'grid', to: 'battery', on: d.grid > 0 },
        { from: 'battery', to: 'site', on: d.offPeak > 0 },
        { from: 'grid', to: 'site', on: r.offPeakUnits - b.plan.offPeak > 0.5 },
      ],
      text: night.length ? night.join(' ') : 'The grid supplies the night load.',
    },
    {
      key: 'demand',
      title: 'Demand spikes',
      when: 'Any time',
      flows: [
        { from: 'battery', to: 'site', on: b.demandCounted > 0 },
        { from: 'grid', to: 'site', on: true },
      ],
      text: demandText,
    },
  ];
}
