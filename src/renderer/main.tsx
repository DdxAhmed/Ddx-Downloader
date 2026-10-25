import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupBrowserPreviewFallback } from './browser-fallback';

// Initialize safe browser preview fallback if running outside Electron
setupBrowserPreviewFallback();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

