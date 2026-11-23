# Ergänzung für umsetzungsplan.md

KI und Agenten in drei Releases:
- K1 kommt nach Release 1.0 und vor Release 1.1 Warengruppenmanagement.
- K2 kommt nach WG-09.
- K3 kommt nach dem ersten Pilot.

Die Release-Bezeichnungen sind Vorschläge; bei Bedarf an die eigene Nummerierung anpassen.

| Paket | Specs | Inhalt | Voraussetzung |
|---|---|---|---|
| K1-a | KI-01 | Gateway mit Anbieter `fake` und `bedrock_eu`, Kosten, Kontingent, Einstellungen | Release 1.0 |
| K1-b | KI-03 | Entwürfe und Quellen, Entwurfskarte | K1-a |
| K1-c | KI-04 | Agenten, Läufe, Werkzeug-Registry, Laufprotokoll, Seite Agenten | K1-b |
| K1-d | KI-15 | Import und Zuordnung von Lieferantenstamm und Spend | K1-c, WG-01 (Warengruppen anlegen) |
| K1-e | KI-16 | Hinweise mit Frühwarnung (erweitert FS-01), „Wo du handeln musst“ auf Start | K1-c, FS-01 |
| K1-f | KI-11 | Wertpotenzial-Finder, Leitprodukt | K1-c, Impact-Ledger, Gemeinsamer Plan |
| K1-g | KI-07 | Termin-Briefing mit Zielen, Agenda und offenen Fragen | K1-e |
| K1-h | KI-17 | Ergebnisse nach dem Termin | K1-g |
| K2-a | KI-08 | Agent Marktanalyse | K1, WG-09 |
| K2-b | KI-13 | Strategie-Autor | K2-a, WG-16 |
| K2-c | KI-18 | Dokumente und Fundstellen, Modellklasse `embed`, `pgvector` | K1 |
| K2-d | KI-19 | Vertragsleck, Import von Bestellzeilen und Gutschriften | K2-c, KI-15 |
| K2-e | KI-20 | Szenarien | K1, WG-16 |
| K2-f | KI-21 | Verhandlungsvorbereitung und Probeverhandlung | K2-d, K2-e |
| K2-g | KI-22 | Quartalsbericht SRM | K1 |
| K3-a | KI-09 | Eigene Agenten | K1, erster Pilot |
| K3-b | KI-23 | Hilfe für Lieferanten | K1, erster Pilot |

Je Paket ein Commit, lokal. Kein `git push`, kein `gh`, keine GitHub-Actions.

Vor K1-a:

- Prüfen, welche KI-Funktionen es schon gibt, zum Beispiel „Fragen“, die Erklärung von Feedback-Lücken oder Themen aus Freitext.
  - Sie laufen ab KI-01 über das Gateway.
  - In KI-04 werden sie als Agenten von Reziproq registriert, statt doppelt gebaut zu werden.
- Prüfen, ob die Kennungen KI-01 bis KI-23 frei sind.
- WG-23 durch die angepasste Fassung aus diesem Paket ersetzen: Die Tabellen `ai_draft` und `ai_source` kommen jetzt aus KI-03, die Einstellungen aus KI-01.
- KI-07 ersetzt die frühere Fassung „Agent QBR-Vorbereitung“. Gibt es den Agenten `qbr_prep` schon, wird er zu `meeting_brief` umbenannt.

Vor K1-d und K1-e:

- Prüfen, ob es schon einen Import für Spend oder Lieferanten gibt. KI-15 erweitert ihn, statt einen zweiten zu bauen.
- KI-16 erweitert Tabelle, Job und Seite der Hinweise aus FS-01. Keine zweite Tabelle.
- Prüfen, welche Termintypen das Modul Termine kennt. Fehlende Typen aus KI-07 ergänzen.
- `pg_trgm` als Postgres-Erweiterung in der Migration aktivieren.

Vor K2-c:

- `pgvector` als Postgres-Erweiterung aktivieren.
- Objektspeicher in der EU für Dateien einrichten, lokal ein Ordner oder MinIO.
- OCR lokal mit `tesseract`. `textract_eu` erst mit echten Zugangsdaten.

Qualität der Agenten:

- Je Agent ein Satz Testfälle mit bekanntem Ergebnis unter `evals/<agent_key>/`: Eingabe-Fixtures, erwartete Entwürfe, verbotene Inhalte.
- `pnpm eval` läuft lokal, mit Anbieter `fake` als Pflicht und `bedrock_eu` von Hand, wenn Zugangsdaten gesetzt sind.
- Ein Agent gilt als fertig, wenn seine Testfälle mit `fake` grün sind und ein Lauf mit `bedrock_eu` alle Regeln der Spec einhält. Geprüft wird das durch die Tests „Zahl nicht in den Eingaben“, „Fundstelle nicht wörtlich“ und „Lieferant sieht nichts“.

Lokal ausprobieren:

- Alles läuft mit dem Anbieter `fake` für Modelle, Websuche und OCR, ohne Zugangsdaten und ohne Netzwerk.
- Für echte Läufe Zugangsdaten für Bedrock in der EU als Umgebungsvariablen setzen und den Anbieter auf `bedrock_eu` stellen. Zugangsdaten nie ins Repository.
- Das Marktumfeld in KI-11 und die Regel `public_event` in KI-16 laufen nur mit dem Anbieter `fake` für die Websuche, bis ein echter Anbieter gewählt ist. Alles andere funktioniert ohne ihn.

Weitere Prüfungen:

- Prüfen, ob es im Impact-Ledger schon Hebel-Vorlagen gibt. KI-11 nutzt sie und ergänzt nur fehlende.
- Prüfen, welche Segmente das Modul SEG kennt. KI-11 und KI-16 laufen für die Segmente, die der Admin wählt; die Namen auf dem Canvas sind Beispiele.

Vorlagen für die Oberfläche:

- In `docs/design/referenz/` liegen `KI-Agenten`, `KI-Lauf`, `KI-Baukasten`, `E-KI`, `KI-Wert`, `KI-Wert-Uebersicht`, `KI-Autor-Start` und `KI-Autor`.
- Dazu kommen `SupplierBar` mit dem Reiter Wertpotenziale und der Link „Als Agent anlegen“ in `Fragen`.
- Vorlagen für K1: `Import-Pruefen` (KI-15), `Hinweise` und `Main` (KI-16), `Termin-Briefing` (KI-07), `Termin-Ergebnisse` (KI-17).
- KI-18 bis KI-23 haben noch keine Vorlage auf dem Canvas. Die Seiten folgen `docs/design/designsprache.md`:
  - höchstens eine Tinte-Karte je Seite;
  - Entwürfe mit gestrichelter Petrol-Kante und Quellen;
  - private Inhalte grau mit Schloss, geteilte mint;
  - Stand immer als Text.
