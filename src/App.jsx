import { useEffect, useState } from 'react';
import { company, defaultInputs } from './config/company.js';
import { touDefaultInputs } from './lib/touCalc.js';
import { BrandMark } from './components/BrandMark.jsx';
import { SectionTabs, SECTIONS } from './components/SectionTabs.jsx';
import { StandardCalculator } from './sections/StandardCalculator.jsx';
import { TouCalculator } from './sections/TouCalculator.jsx';

function sectionFromUrl() {
  const found = SECTIONS.find((s) => s.hash && s.hash === window.location.hash);
  return found ? found.id : SECTIONS[0].id;
}

// The open calculator follows the address (…/#time-of-use), so a link can open either one.
function useSection() {
  const [section, setSection] = useState(sectionFromUrl);

  useEffect(() => {
    const sync = () => setSection(sectionFromUrl());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    const { pageTitle } = SECTIONS.find((s) => s.id === section);
    document.title = `${pageTitle} | ${company.name}`;
  }, [section]);

  const select = (id) => {
    setSection(id);
    const { hash } = SECTIONS.find((s) => s.id === id);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  };

  return [section, select];
}

export default function App() {
  const [section, selectSection] = useSection();
  // Each calculator keeps its figures while the other one is open.
  const [standardValues, setStandardValues] = useState(defaultInputs);
  const [touValues, setTouValues] = useState(touDefaultInputs);

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <BrandMark />
          <a className="topbar-link" href={company.website} target="_blank" rel="noreferrer">
            {company.websiteLabel.replace(/^www\./, '')}
          </a>
        </div>
      </header>

      <main className="wrap">
        <div className="intro">
          <h1>Solar savings calculator</h1>
          <p>
            See how much a rooftop solar system saves and earns each month, and how soon it pays for itself. Then download
            the full report as a PDF.
          </p>
        </div>

        <SectionTabs active={section} onSelect={selectSection} />

        <div className="calc-panel" role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
          {section === 'tou' ? (
            <TouCalculator values={touValues} setValues={setTouValues} />
          ) : (
            <StandardCalculator values={standardValues} setValues={setStandardValues} />
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <p className="footer-name">{company.legalName}</p>
            <address>{company.address.join(', ')}</address>
          </div>
          <div className="footer-contact">
            <a href={company.website} target="_blank" rel="noreferrer">
              {company.websiteLabel}
            </a>
            {company.phone && <a href={`tel:${company.phone.replace(/\s+/g, '')}`}>{company.phone}</a>}
            {company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}
          </div>
        </div>
        <div className="wrap">
          <p className="footer-note">
            Figures are estimates based on the values entered and assume they stay the same every month. Actual results
            depend on weather, system performance, consumption and tariff revisions.
          </p>
        </div>
      </footer>
    </>
  );
}
