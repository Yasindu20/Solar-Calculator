import { batteryStory } from '../../lib/batteryStory.js';

const ICONS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" className="icon-fill-sun" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  grid: <path d="M12 2.5 7.5 21.5M12 2.5l4.5 19M5.5 7h13M6.8 12.5h10.4M9 7l6 5.5M15 7l-6 5.5M8.2 17.5h7.6" />,
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="2" />
      <path d="M21.5 10.5v3" />
      <rect x="5" y="9.5" width="8" height="5" rx="1" className="icon-fill-battery" />
    </>
  ),
  site: (
    <>
      <path d="M2.5 21.5v-10l5.5 3.5v-3.5l5.5 3.5v-3.5l5.5 3.5V4.5h3v17z" />
      <path d="M6 18h2.5M10.5 18H13M15 18h2.5" />
    </>
  ),
};

const NAMES = { sun: 'Solar', grid: 'Grid', battery: 'Battery', site: 'Your site' };

function Node({ kind }) {
  return (
    <span className={`flow-node flow-node-${kind}`} title={NAMES[kind]}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {ICONS[kind]}
      </svg>
    </span>
  );
}

function Flow({ from, to, on }) {
  return (
    <div className={`flow${on ? ' is-on' : ''}`}>
      <Node kind={from} />
      <span className="flow-line" />
      <Node kind={to} />
    </div>
  );
}

// Four moments in the battery's day, with the flows that are running for this customer lit up.
export function BatteryFlow({ results: r }) {
  const steps = batteryStory(r);

  return (
    <ol className="flow-cards">
      {steps.map((s) => (
        <li key={s.key} className="flow-card">
          <p className="flow-title">
            <strong>{s.title}</strong> <span>{s.when}</span>
          </p>
          <div className="flow-rows" aria-hidden="true">
            {s.flows.map((f) => (
              <Flow key={`${f.from}-${f.to}`} {...f} />
            ))}
          </div>
          <p className="flow-text">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
