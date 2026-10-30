# PLT-12 Prompt-Fenster

Release 0.1 · Reihenfolge 12 · baut auf PLT-11, PLT-03, PLT-05, PLT-06 · neu, steht noch nicht in der Anforderungsliste

## Ziel

Als Nutzer frage ich Reziproq in einfachen Sätzen nach meinen Lieferanten oder springe direkt zu einem Bereich, statt mich durch Menüs zu klicken.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Prompt-Fenster öffnen, Fragen stellen, Antworten und Treffer sehen, zu Seiten springen. |
| Die KI selbst | Sieht genau das, was der fragende Nutzer sehen darf. Sie arbeitet über dieselben Dienste wie die Oberfläche, mit Mandanten-Session (PLT-02) und `can()` (PLT-05). Sie hat keinen eigenen Datenbankzugriff. |
| Lieferant | Nicht Teil. Ab Release 0.2 nur mit geteilten Daten. |

## Daten

- Keine neuen Fachdaten.
- Frage und Antwort leben nur in der laufenden Sitzung im Browser und werden nicht gespeichert.
- Das Protokoll enthält nur Zeitpunkt, Nutzer-ID, Organisation, Dauer, Anzahl Tokens und Erfolg oder Fehler. Den Text von Frage oder Antwort enthält es nie.
- Die KI nutzt nur diese Werkzeuge, alle nur lesend:

| Werkzeug | Macht | Daten |
|---|---|---|
| `lieferanten_suchen` | Sucht Lieferanten nach Name, Land, BU, Warengruppe, Mindest- oder Höchstspend und Jahr. Sortiert, höchstens 20 Treffer. | Derselbe Dienst wie die Lieferantenseite (PLT-03, PLT-06) |
| `bereich_oeffnen` | Schickt die Oberfläche zu einem der festen Bereiche aus PLT-11 | Keine |

- Die KI schreibt keine Datenbankabfragen und ruft keine anderen Adressen auf.
- **KI-Anbieter** über die Umgebungsvariable `AI_PROVIDER` (Eintrag in `.env.example`):
  - `test` (Standard): festes Testmodell ohne Schlüssel, für lokale Entwicklung und die automatische Prüfung.
  - `anthropic`: Claude über einen eigenen API-Schlüssel aus der Claude Console. Nur mit Beispieldaten.
  - `bedrock`: Claude über Amazon Bedrock in der EU. Pflicht für echte Kundendaten, kommt mit der Testumgebung ab März 2027.
- Modellname über `AI_MODEL`, nicht fest im Code.
- Umgesetzt mit dem Vercel AI SDK, damit der Anbieterwechsel nur eine Einstellung ist.

## Ablauf

1. Auf der Übersicht steht unter der Begrüßung ein großes Eingabefeld: „Frag Reziproq …“.
2. Von jeder Seite aus öffnet **Cmd+K** (Mac) oder **Ctrl+K** (Windows) dasselbe Fenster als Overlay in der Bildmitte, wie Spotlight. Der Fokus liegt sofort im Feld.
3. Im leeren Fenster stehen drei Vorschläge als Knöpfe. Ein Klick übernimmt den Text:
   - „Zeig mir die Lieferanten mit dem höchsten Spend“
   - „Welche Lieferanten haben wir in der Warengruppe Elektronik?“
   - „Öffne den Beziehungspuls“
4. Der Nutzer tippt und drückt Enter. Die Antwort erscheint Wort für Wort darunter.
5. Gefundene Lieferanten erscheinen unter dem Text als Karten wie auf der Lieferantenseite. Ein Klick öffnet ihr Detail-Panel.
6. Bei „Öffne …“ wechselt die Seite, und das Fenster schließt sich.
7. Folgefragen beziehen sich auf die vorige, solange das Fenster offen ist. „Neu beginnen“ leert den Verlauf.
8. Esc oder ein Klick daneben schließt das Fenster.
9. Unter dem Feld steht klein: „Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.“

### Regeln für die KI

Diese Regeln stehen im System-Prompt.

- Antwortet in der Sprache des Nutzers (PLT-09), kurz, Ergebnis zuerst.
- Nennt nur Zahlen und Namen, die aus einem Werkzeug kommen. Fehlen Daten, sagt sie das, statt zu schätzen.
- Bewertet keine Personen.
- Gibt keine Empfehlungen zu Segment oder Beziehungstyp. Das entscheidet der SRO mit der Segmentierung.
- Bei Fragen außerhalb von Reziproq sagt sie kurz, wofür sie da ist.

### Gestaltung

- Großes Eingabefeld mit großem Radius und einem dezenten Symbol links.
- Overlay mit leicht abgedunkeltem, unscharfem Hintergrund.
- Ruhiger Ladezustand, z. B. drei pulsierende Punkte.
- Fehlerzustand: „Gerade keine Antwort möglich. Versuch es gleich noch einmal.“
- Alles aus Tokens und Styleguide (PLT-10), Klickflächen mindestens 44 × 44 px.

## Fertig, wenn

Je Kriterium ein Test. Alle Tests laufen mit `AI_PROVIDER=test`, ohne Schlüssel und ohne Internet.

- [ ] Cmd+K und Ctrl+K öffnen das Fenster auf jeder Seite, mit dem Fokus im Feld. Esc schließt es.
- [ ] Das Feld auf der Übersicht öffnet dasselbe Fenster.
- [ ] Die drei Vorschläge erscheinen im leeren Fenster. Ein Klick übernimmt den Text.
- [ ] „Öffne den Beziehungspuls“ führt zu `/puls` und schließt das Fenster.
- [ ] Eine Frage nach Lieferanten ruft `lieferanten_suchen` auf. Gezeigte Karten und Zahlen stimmen mit der Datenbank überein.
- [ ] Ein Nutzer des Zweit-OEM bekommt nie Lieferanten oder Werte des Test-OEM, auch wenn er ausdrücklich danach fragt.
- [ ] Ohne Login antwortet der Endpunkt mit 401. Ein Nutzer ohne Organisation bekommt 403.
- [ ] Liefert das Werkzeug nichts, zeigt die Oberfläche „Keine Treffer“.
- [ ] Die Antwort streamt. Lade- und Fehlerzustand sind sichtbar.
- [ ] Das Protokoll enthält keinen Text aus Frage oder Antwort.
- [ ] Die API startet nicht, wenn `AI_PROVIDER=anthropic` und `NODE_ENV=production`.
- [ ] Die Zahl der Anfragen je Nutzer und Minute ist begrenzt. Der Wert steht in der Konfiguration. Darüber erscheint eine freundliche Meldung.
- [ ] Die automatische Prüfung auf GitHub bleibt ohne Schlüssel grün.

## Nicht Teil dieser Funktion

- Daten per Prompt anlegen oder ändern. Das kommt später und dann nur als Entwurf, der erst nach Klick auf „Freigeben“ gilt.
- Gespeicherter Verlauf über die Sitzung hinaus
- Prompt-Fenster für Lieferanten-Nutzer (0.2)
- Anbindung an Amazon Bedrock (mit der Testumgebung ab März 2027)
- Dateien hochladen, Spracheingabe
- KI-Erklärungen zu Abweichungen (SEG-08) und Pre-Read-Entwürfe (QBR-05)
