import { useRef } from 'react';

function HomeIcon() {
  return (
    <svg className="calc-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 11 12 4l8.5 7M6 9.2V20h12V9.2M10 20v-5.5h4V20" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="calc-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

// The two calculators. Named by what the customer's bill looks like, so picking one needs no explaining.
export const SECTIONS = [
  {
    id: 'standard',
    hash: '',
    title: 'Standard bill',
    text: 'Homes and small shops. The bill shows one total of units.',
    short: 'One units total',
    pageTitle: 'Solar savings calculator',
    Icon: HomeIcon,
  },
  {
    id: 'tou',
    hash: '#time-of-use',
    title: 'Time-of-use bill',
    text: 'Factories, hotels and offices. The bill shows Day, Peak and Off-peak units.',
    short: 'Day · Peak · Off-peak',
    pageTitle: 'Time-of-use solar calculator',
    Icon: ClockIcon,
  },
];

export function SectionTabs({ active, onSelect }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    const i = SECTIONS.findIndex((s) => s.id === active);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (step) next = SECTIONS[(i + step + SECTIONS.length) % SECTIONS.length];
    if (e.key === 'Home') next = SECTIONS[0];
    if (e.key === 'End') next = SECTIONS[SECTIONS.length - 1];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="calc-tabs" role="tablist" aria-label="Which electricity bill does the customer have?" onKeyDown={onKeyDown}>
      {SECTIONS.map(({ id, title, text, short, Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls={selected ? `panel-${id}` : undefined}
            tabIndex={selected ? 0 : -1}
            className="calc-tab"
            onClick={() => onSelect(id)}
          >
            <Icon />
            <span className="calc-tab-body">
              <span className="calc-tab-title">{title}</span>
              <span className="calc-tab-text">{text}</span>
              <span className="calc-tab-short">{short}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
