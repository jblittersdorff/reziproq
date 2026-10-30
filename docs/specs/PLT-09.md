# PLT-09 Deutsch und Englisch

Release 0.1 · Reihenfolge 11 · baut auf PLT-11 · kann jederzeit nach PLT-11 kommen, weil alle Texte schon in der Übersetzungsdatei stehen

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
- Übersetzungsdateien `de` und `en` mit identischen Schlüsseln. Bibliothek mit erlaubter Lizenz (MIT), Version fest gepinnt.
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

1. Der Nutzer öffnet **Einstellungen** und wählt unter **Sprache** Deutsch oder Englisch.
2. Die Oberfläche wechselt sofort, ohne Neuladen und ohne Neuanmeldung.
3. Beträge, Daten und Zahlen erscheinen im Format der Sprache. Die Währung bleibt die des Betrags.
4. Beim nächsten Login gilt die gespeicherte Sprache, auch auf einem anderen Gerät.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] `de` und `en` haben genau dieselben Schlüssel. Ein Test scheitert bei jedem fehlenden oder überzähligen Schlüssel.
- [ ] Ein Playwright-Test besucht jede Route auf Englisch. Keine Seite zeigt einen rohen Schlüssel oder deutschen Text aus der Übersetzungsdatei.
- [ ] Die Umstellung wirkt sofort und bleibt nach Abmelden und erneutem Anmelden erhalten.
- [ ] Beträge, Daten und Zahlen erscheinen je Sprache richtig formatiert.
- [ ] Fehlermeldungen der API erscheinen in der gewählten Sprache.
- [ ] Die Begriffe in `en` entsprechen dem Glossar (Test gegen eine Liste der Glossar-Schlüssel).

## Nicht Teil dieser Funktion

- Weitere Sprachen
- Übersetzung von Inhalten, die Nutzer eingeben
- Englische Fragebögen des Pulses (kommen mit PUL-01, das DE und EN selbst verlangt)
- E-Mails (QS-01)
