# PLT-09 Deutsch und Englisch

Release 0.1 · baut auf PLT-11 · kann jederzeit nach PLT-11 kommen, weil alle Texte schon in der Übersetzungsdatei stehen

## Ziel

Als Nutzer arbeite ich in Deutsch oder Englisch. Jede Seite ist in beiden Sprachen vollständig, auch Zahlen, Daten und Beträge.

## Wer darf was

| Rolle | Darf |
|---|---|
| Jeder angemeldete Nutzer | Seine Sprache in den Einstellungen wählen. |
| Lieferant | Gleiches Recht, sobald er Zugang hat (0.2). |

## Daten

- `app_user.locale` (`de` oder `en`). Beim ersten Login kommt die Sprache aus dem Browser, sonst Deutsch.
- Die Sprache liegt in der Datenbank, nicht nur im Browser, damit spätere E-Mails (QS-01) in der richtigen Sprache rausgehen.
- Übersetzungsdateien `de` und `en` mit identischen Schlüsseln, als typisierte TypeScript-Kataloge ohne zusätzliche Bibliothek. TypeScript prüft jeden Schlüssel schon beim Bauen.
- Zahlen, Daten und Beträge über `Intl` nach Sprache: „1.234.567 €“ und „€1,234,567“.
- Die API liefert Fehler als Codes. Die Oberfläche übersetzt sie.
- **Glossar** in `docs/glossar.md`. Fachbegriffe sind in beiden Sprachen festgelegt, damit Claude Code sie nicht jedes Mal neu übersetzt:

| Deutsch | Englisch |
|---|---|
| Lieferant | Supplier |
| Beziehung | Relationship |
| Beziehungspuls | Relationship Pulse |
| Warengruppe | Category |
| Business Unit | Business Unit |
| SRO, JBP, QBR | bleiben gleich |
| P&L-Impact | P&L Impact |
| Maßnahme | Action |
| Zusage | Commitment |

## Ablauf

1. Der Nutzer öffnet **Profil** (`/profil`) und wählt unter **Sprache** Deutsch oder Englisch.
2. Die Oberfläche wechselt sofort, ohne Neuladen und ohne Neuanmeldung.
3. Beträge, Daten und Zahlen erscheinen im Format der Sprache. Die Währung bleibt die des Betrags.
4. Beim nächsten Login gilt die gespeicherte Sprache, auch auf einem anderen Gerät.

## Fertig, wenn

Je Kriterium ein Test.

- [x] `de` und `en` haben genau dieselben Schlüssel. Ein Test scheitert bei jedem fehlenden oder überzähligen Schlüssel.
- [x] Ein Playwright-Test besucht jede Route auf Englisch. Keine Seite zeigt einen rohen Schlüssel oder deutschen Text aus der Übersetzungsdatei.
- [x] Die Umstellung wirkt sofort und bleibt nach Abmelden und erneutem Anmelden erhalten.
- [x] Beträge, Daten und Zahlen erscheinen je Sprache richtig formatiert.
- [x] Fehlermeldungen der API erscheinen in der gewählten Sprache.
- [x] Die Begriffe in `en` entsprechen dem Glossar (Test gegen eine Liste der Glossar-Schlüssel).

## Umgesetzt mit

- **Datenbank:** `app_user.locale` (`de`, `en` oder leer) mit Migration `0016_sprache`.
  - Die Anmeldefunktion übernimmt die Browsersprache nur, solange die Spalte leer ist. So bekommen auch bestehende Personen beim nächsten Login ihre Browsersprache.
  - `app_sprache_setzen` und `app_sprache_des_nutzers` sind Datenbankfunktionen, die nur `reziproq_api` ausführen darf und die nur die eigene Zeile betreffen.
- **API:**
  - `POST /api/me/anmeldung` nimmt `{ browserLocale }` an.
  - `PUT /api/me/sprache` setzt die eigene Sprache.
  - `/me` liefert `locale`. Ohne gespeicherte Sprache gilt Deutsch.
  - Wie alles unter `/me` braucht das keine Aktion in der Rechte-Matrix.
- **Oberfläche:**
  - Vor dem Login gilt die erste Sprache aus `navigator.languages`, die `de` oder `en` ist, sonst Deutsch. Sobald `/me` geladen ist, gilt die gespeicherte Sprache.
  - Gewählt wird auf `/profil/sprache`, wie das Erscheinungsbild.
  - Alle Formate laufen über `lib/format.ts` (`useFormat`). Das Spend-Feld nimmt Beträge im Format der Sprache an.
- **Glossar:** `docs/glossar.md` enthält die Begriffe der Spec und die schon genutzten Fachbegriffe, mit den Stellen in den Katalogen.
  - Daraus folgen Änderungen im Englischen: „Commodity group“ heißt jetzt „Category“, „Joint plan“ heißt „Joint Business Plan“.
  - Statt „P&L-Impact“ steht im Deutschen „GuV-Wirkung“, wie in CLAUDE.md.
- **Playwright-Test über alle Routen:** Er liest die Routen aus `routeTree.gen.ts`. Er scheitert an deutschen Texten aus `de.ts` (als ganze Wörter) und an rohen Schlüsseln.
- Die Styleguide-Beispielfirma „Logistik West“ heißt jetzt „Westfracht“, damit der Routentest nicht auf einen Firmennamen anschlägt.

## Nicht Teil dieser Funktion

- Weitere Sprachen
- Übersetzung von Inhalten, die Nutzer eingeben
- Englische Fragebögen des Pulses (kommen mit PUL-01, das DE und EN selbst verlangt)
- E-Mails (QS-01)
