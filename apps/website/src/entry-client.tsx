import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app';
import { match } from './site';
import './styles.css';

// Vorgerendert: hydratisieren (z. B. für den Preisrechner). In der Entwicklung: neu zeichnen.
const route = match(window.location.pathname) ?? { page: 'home', locale: 'en' };
document.documentElement.lang = route.locale;
const root = document.getElementById('root');
if (root) {
  const app = (
    <StrictMode>
      <App page={route.page} locale={route.locale} />
    </StrictMode>
  );
  if (root.hasChildNodes()) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
