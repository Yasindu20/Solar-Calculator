import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-700.css';
import './styles.css';

import { applyBrandColors } from './config/brand.js';
import App from './App.jsx';

applyBrandColors();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
