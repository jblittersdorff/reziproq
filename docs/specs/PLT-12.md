# PLT-12 Prompt-Fenster

Release 0.1 · neu · baut auf PLT-11 und PLT-02 auf

## Ziel

Als Nutzer frage ich Reziproq in einfachen Sätzen nach meinen Lieferanten oder springe direkt zu einem Bereich, statt mich durch Menüs zu klicken.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin, Nutzer, Leser, Controlling | Prompt-Fenster öffnen, Fragen stellen, Antworten und Treffer sehen, zu Seiten springen. |
| Die KI selbst | Sieht genau das, was der fragende Nutzer sehen darf. Sie arbeitet mit seinen Rechten über dieselben Abfragen wie die Oberfläche und hat keinen eigenen Datenbankzugriff. |
| Lieferant | Nicht Teil dieser Funktion. Ab Release 0.2 nur mit geteilten Daten. |

## Daten

- Keine neuen Fachdaten.
- Frage und Antwort leben nur in der laufenden Sitzung im Browser und werden nicht gespeichert.
- Das Protokoll enthält nur Zeitpunkt, Nutzer-ID, Dauer, Anzahl Tokens und Erfolg oder Fehler, nie den Text der Frage oder Antwort.
- Die KI nutzt nur diese Werkzeuge, alle nur lesend:

| Werkzeug | Macht | Daten |
|---|---|---|
| `lieferanten_suchen` | Sucht Lieferanten nach Name, Warengruppe, Land, Mindest- oder Höchstspend, sortiert, höchstens 20 Treffer | Nutzt denselben Dienst wie `GET /suppliers`, also nur käuferprivate Daten der eigenen Organisation |
| `bereich_oeffnen` | Schickt die Oberfläche zu einem der festen Bereiche aus PLT-11 | Keine |

- Die KI schreibt keine Datenbankabfragen und ruft keine anderen Adressen auf.
- **KI-Anbieter** über Konfiguration, Name in `.env.example`, z. B. `KI_ANBIETER`:
  - `test`: Standard. Festes Testmodell ohne Schlüssel, für lokale Entwicklung und die automatische Prüfung.
  - `anthropic`: Claude über einen eigenen API-Schlüssel. Nur mit Beispieldaten.
  - `bedrock`: Claude über Amazon Bedrock in der EU. Pflicht für echte Kundendaten, kommt mit der Testumgebung ab März 2027.
- Umgesetzt mit dem Vercel AI SDK, damit der Anbieterwechsel nur eine Einstellung ist.

## Ablauf

1. Auf der Übersicht steht unter der Begrüßung ein großes Eingabefeld: „Frag Reziproq …“.
2. Von jeder Seite aus öffnet **Cmd+K** (Mac) oder **Ctrl+K** (Windows) dasselbe Fenster als Overlay in der Bildmitte, wie Spotlight. Der Fokus liegt sofort im Eingabefeld.
3. Im leeren Fenster stehen drei Vorschläge als Knöpfe. Ein Klick übernimmt den Text:
   - „Zeig mir die Lieferanten mit dem höchsten Spend“
   - „Welche Lieferanten haben wir in der Warengruppe Elektronik?“
   - „Öffne den Beziehungspuls“
4. Der Nutzer tippt und drückt Enter. Die Antwort erscheint Wort für Wort darunter.
5. Gefundene Lieferanten erscheinen unter dem Text als große Karten wie auf der Lieferantenseite.
6. Bei „Öffne …“ wechselt die Seite, und das Fenster schließt sich.
7. Weitere Fragen schließen an die vorherige an, solange das Fenster offen ist. „Neu beginnen“ leert den Verlauf.
8. Esc oder ein Klick daneben schließt das Fenster.
9. Unter dem Eingabefeld steht klein: „Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.“

### Regeln für die KI

Diese Regeln stehen im System-Prompt.

- Antwortet auf Deutsch, kurz, Ergebnis zuerst.
- Nennt nur Zahlen und Namen, die aus einem Werkzeug kommen. Fehlen Daten, sagt sie das, statt zu schätzen.
- Bewertet keine Personen.
- Gibt keine Empfehlungen zu Segment oder Beziehungstyp. Diese Bewertung kommt erst mit SEG-Funktionen und bleibt Entscheidung des SRO.
- Bei Fragen außerhalb von Reziproq sagt sie kurz, wofür sie da ist.

### Gestaltung

- Eingabefeld groß, mit großem Radius, gut lesbarer Schrift und einem dezenten Symbol links.
- Overlay mit leicht abgedunkeltem, unscharfem Hintergrund. Das ist der einzige Ort neben der Seitenleiste, an dem Glas-Effekte erlaubt sind.
- Ladezustand ruhig, z. B. drei pulsierende Punkte. Fehlerzustand: „Gerade keine Antwort möglich. Versuch es gleich noch einmal.“
- Alles aus Tokens, Skill `ui-design`, Klickflächen mindestens 44 × 44 px.

## Fertig, wenn

Je Kriterium ein Test. Alle Tests laufen mit `KI_ANBIETER=test`, ohne Schlüssel und ohne Internet.

- [ ] Cmd+K und Ctrl+K öffnen das Fenster auf jeder Seite. Der Fokus liegt im Feld. Esc schließt.
- [ ] Das Feld auf der Übersicht öffnet dasselbe Fenster.
- [ ] Die drei Vorschläge erscheinen im leeren Fenster. Ein Klick übernimmt den Text.
- [ ] „Öffne den Beziehungspuls“ führt zu `/puls` und schließt das Fenster.
- [ ] Eine Frage nach Lieferanten ruft `lieferanten_suchen` auf. Die gezeigten Karten und Zahlen stimmen mit der Datenbank überein.
- [ ] Datentrennung: Ein Nutzer des Zweit-OEM bekommt nie Lieferanten oder Werte des Beispiel-OEM, auch wenn er ausdrücklich danach fragt.
- [ ] Ohne Login antwortet der Endpunkt mit 401.
- [ ] Liefert das Werkzeug nichts, zeigt die Oberfläche „Keine Treffer“ statt leerer Karten.
- [ ] Die Antwort streamt. Lade- und Fehlerzustand sind sichtbar.
- [ ] Das Protokoll enthält keinen Text aus Frage oder Antwort.
- [ ] Die API startet nicht, wenn `KI_ANBIETER=anthropic` und `NODE_ENV=production`.
- [ ] Die Zahl der Anfragen je Nutzer und Minute ist begrenzt. Der Wert steht in der Konfiguration, darüber kommt eine freundliche Meldung.
- [ ] Die automatische Prüfung auf GitHub bleibt ohne Schlüssel grün.

## Nicht Teil dieser Funktion

- Daten per Prompt anlegen oder ändern. Kommt später, und dann nur als Entwurf, der erst nach Klick auf „Freigeben“ gilt.
- Gespeicherter Verlauf über die Sitzung hinaus
- Prompt-Fenster für Lieferanten-Nutzer (Release 0.2)
- Anbindung an Amazon Bedrock (mit der Testumgebung ab März 2027)
- Dateien hochladen, Spracheingabe
- KI-Erklärungen zu Abweichungen (SEG-08) und Pre-Read-Entwürfe (QBR-05)
