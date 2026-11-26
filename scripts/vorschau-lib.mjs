// Feste Vorschau (26.11.2026): reine Hilfen für scripts/vorschau.mjs, getestet in
// scripts/vorschau.test.mjs.

/** Ordner der Vorschau: im Nachbarordner `<repo>-vorschau`, sonst VORSCHAU_DIR */
export function vorschauDir(repoDir, override) {
  return override ? override.replace(/\/+$/, '') : `${repoDir}-vorschau`;
}

/** Name der Datenbank in einer Datenbank-URL */
export function databaseName(url) {
  return new URL(url).pathname.replace(/^\//, '');
}

/** Nur eine Datenbank der Vorschau darf die Vorschau löschen und neu anlegen */
export function isVorschauDatabase(name) {
  return /^[a-z0-9_]+_vorschau$/.test(name);
}

/**
 * Datenbank der Vorschau zu einer Datenbank-URL: derselbe Server und dieselbe Rolle, Name mit
 * Endung _vorschau. So berührt die Vorschau weder die Entwicklungs- noch die Testdatenbank.
 */
export function vorschauUrl(url) {
  const parsed = new URL(url);
  const name = databaseName(url);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Ungültiger Datenbankname: ${name}`);
  parsed.pathname = `/${isVorschauDatabase(name) ? name : `${name}_vorschau`}`;
  return parsed.toString();
}
