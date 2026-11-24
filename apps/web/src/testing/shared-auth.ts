// Ein Anmeldezustand für alle Testdateien eines Workers. Die Web-Tests teilen sich die Module
// (vitest.config.ts, isolate: false); das ersetzte Modul react-oidc-context liest deshalb immer
// diesen einen Zustand, egal welche Datei es zuerst geladen hat. Jede Datei setzt auth.state in
// beforeEach selbst.
const holder = globalThis as typeof globalThis & {
  reziproqTestAuth?: { state: Record<string, unknown> };
};
holder.reziproqTestAuth ??= { state: {} };
