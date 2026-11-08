# PLT-12 Fragen-Seite

Release 0.1 · baut auf PLT-11, PLT-03, PLT-05, PLT-06, NAV-06 · deckt ab PLT-12, NAV-11 · überarbeitet am 31.10.2026: eigene Seite statt Overlay

## Ziel

Als Nutzer frage ich Reziproq in einfachen Sätzen nach meinen Lieferanten oder springe direkt zu einem Bereich, statt mich durch Menüs zu klicken.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Fragen stellen, Antworten und Treffer sehen, zu Seiten springen. |
| Die KI | Sieht genau das, was der fragende Nutzer sehen darf. Sie arbeitet über dieselben Dienste wie die Oberfläche, mit Mandanten-Session und `can()`, und hat keinen eigenen Datenbankzugriff. |
| Lieferant | Nicht Teil. |

## Daten

- Keine neuen Fachdaten.
- Fragen und Antworten liegen nur im Browser, solange die Seite offen ist.
- Das Protokoll enthält nur Zeitpunkt, Nutzer-ID, Organisation, Dauer, Tokens und Erfolg, nie Text.
- Die Werkzeuge der KI lesen nur:

| Werkzeug | Macht |
|---|---|
| `lieferanten_suchen` | Sucht nach Name, Land, BU, Warengruppe, Spend und Jahr. Liefert höchstens 20 Treffer über denselben Dienst wie die Lieferantenliste. |
| `seite_oeffnen` | Bereitet einen Link zu einem festen Hauptbereich oder zum Spend eines exakt gefundenen Lieferanten vor. Die Oberfläche navigiert erst nach Klick. |

- Die KI schreibt keine Datenbankabfragen.
- Anbieter über `AI_PROVIDER`: `test` (Standard, ohne Schlüssel), `anthropic` (nur mit Beispieldaten), `bedrock` (ab Staging, Pflicht für echte Daten). Im Betrieb sind ausschließlich Bedrock-Aufrufe aus einer AWS-EU-Region zulässig.
- Modell und Rate-Limit kommen aus `AI_MODEL` und `AI_REQUESTS_PER_MINUTE`. Umgesetzt mit dem Vercel AI SDK und der AWS SDK Default Credential Provider Chain.

## Ablauf

1. **Fragen** (`/fragen`) ist eine eigene Seite: oben ein großes Eingabefeld, darunter drei Vorschläge:
   - „Zeig mir die Lieferanten mit dem höchsten Spend“
   - „Welche Lieferanten haben wir in der Warengruppe Elektronik?“
   - „Öffne den Spend von Beispiel AG (Demo)“
2. **Cmd+K** (Mac) bzw. **Ctrl+K** öffnet die Seite von überall. Das Feld auf Start (NAV-05) springt mit der Frage dorthin (`/fragen?q=…`).
3. Die Antwort erscheint Wort für Wort. Treffer stehen darunter als Karten und führen zum Lieferanten.
4. Bei „Öffne …“ zeigt die Antwort einen Knopf zur Zielseite. Ein Klick öffnet sie, Zurück führt wieder zu Fragen.
5. Folgefragen beziehen sich auf die vorige, bis „Neu beginnen“ oder bis die Seite verlassen wird.
6. Unter dem Feld steht: „Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.“

### Regeln für die KI

Sie stehen im System-Prompt:

- Sie antwortet in der Sprache des Nutzers, kurz, mit dem Ergebnis zuerst.
- Sie nennt nur Zahlen und Namen aus Werkzeugen. Fehlt etwas, sagt sie das.
- Sie bewertet keine Personen und gibt keine Empfehlung zu Segmenten.

## Fertig, wenn

Je Kriterium ein Test. Alle laufen mit `AI_PROVIDER=test`, ohne Schlüssel und ohne Internet.

- [x] Cmd+K und Ctrl+K öffnen `/fragen` mit Fokus im Feld. Zurück führt zur Ausgangsseite.
- [x] `/fragen?q=…` stellt die Frage beim Öffnen; Start übergibt die Frage in der URL.
- [x] Ein Klick auf einen Vorschlag übernimmt ihn.
- [x] Fragen zu Lieferanten rufen `lieferanten_suchen` über den geschützten Dienst auf. Karten und Zahlen stimmen mit der Datenbank überein; BU, Warengruppe und Jahr sind Filter.
- [x] Ein Nutzer des Zweit-OEM bekommt nie Daten des Test-OEM, auch nicht auf ausdrückliche Frage.
- [x] Ohne Login gibt es 401, ohne Organisation 403.
- [x] Keine Treffer zeigt „Keine Treffer“. Lade- und Fehlerzustand sind sichtbar.
- [x] Das Protokoll enthält keinen Text aus Frage oder Antwort.
- [x] Die API startet nicht mit `AI_PROVIDER=anthropic` und `NODE_ENV=production`.
- [x] Bedrock benötigt Region und Anthropic-Modell-ID; Produktionsaufrufe sind auf AWS-EU-Regionen beschränkt.
- [x] Die Anfragen je Nutzer und Minute sind begrenzt; der Wert steht in der Konfiguration.
- [x] Bereiche und exakt gefundene Lieferanten-Spend-Ziele erscheinen als Links; Navigation erfolgt erst nach Klick.
- [x] Es gibt kein Overlay und kein Fenster (Prüfung aus PLT-10).

## Nicht Teil dieser Funktion

- Daten per Prompt anlegen oder ändern
- Gespeicherter Verlauf
- Fragen für Lieferanten
- Suche über Initiativen und Maßnahmen (QS-05)
- KI-Entwürfe in Modulen (SEG-11, PUL-08, SPL-10, QBR-07)
