import { useEffect, useRef, useState } from 'react';
import { App } from './app';
import { content } from './i18n';
import { type Locale, match, type PageKey } from './site';

export interface Route {
  page: PageKey;
  locale: Locale;
}

/** Ziel eines Klicks, wenn die Website ihn selbst übernimmt; sonst null (Browser lädt normal) */
export function internalTarget(event: MouseEvent, origin: string): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, origin);
  if (url.origin !== origin || !match(url.pathname)) return null;
  return url;
}

/**
 * WEB-01: Wechsel zwischen den Seiten ohne Neuladen. Die Links bleiben normale Verweise auf die
 * vorgerenderten Seiten (für Suchmaschinen und ohne JavaScript); mit JavaScript tauscht die Website
 * nur den Inhalt, setzt Adresse, Titel und Sprache und springt nach oben oder zum Anker.
 * Zurück und Vor im Browser funktionieren über popstate.
 */
export function Site({ initial }: { initial: Route }) {
  const [route, setRoute] = useState(initial);
  const [hash, setHash] = useState<string | null>(null);
  // Zuletzt gezeigte Seite; beim ersten Laden (auch doppelt im StrictMode) bleibt alles beim Browser
  const shown = useRef(`${initial.page}|${initial.locale}|`);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const url = internalTarget(event, window.location.origin);
      if (!url) return;
      // Anker auf derselben Seite: der Browser springt selbst
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      const next = match(url.pathname);
      if (!next) return;
      window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
      setHash(url.hash || null);
      setRoute(next);
    };
    const onPop = () => {
      const next = match(window.location.pathname);
      if (next) {
        setHash(window.location.hash || null);
        setRoute(next);
      }
    };
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
    document.title = content[route.locale].meta.titles[route.page];
    document.documentElement.lang = route.locale;
  }, [route]);

  // Nach dem Wechsel: zum Anker oder nach oben; der Fokus geht auf den Inhalt (Tastatur, Screenreader)
  useEffect(() => {
    const key = `${route.page}|${route.locale}|${hash ?? ''}`;
    if (shown.current === key) return;
    shown.current = key;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView?.();
    else window.scrollTo?.(0, 0);
    if (!target) document.getElementById('inhalt')?.focus({ preventScroll: true });
  }, [route, hash]);

  return <App page={route.page} locale={route.locale} />;
}
