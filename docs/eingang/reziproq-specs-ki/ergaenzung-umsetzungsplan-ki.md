# Ergänzung für umsetzungsplan.md

KI und Agenten in drei Releases. K1 nach Release 1.0 und vor Release 1.1 Warengruppenmanagement. K2 nach WG-09. K3 nach dem ersten Pilot. Die Release-Bezeichnungen sind Vorschläge; bei Bedarf an die eigene Nummerierung anpassen.

| Paket | Specs | Inhalt | Voraussetzung |
|---|---|---|---|
| K1-a | KI-01 | Gateway mit Anbieter `fake` und `bedrock_eu`, Kosten, Kontingent, Einstellungen | Release 1.0 |
| K1-b | KI-03 | Entwürfe und Quellen, Entwurfskarte | K1-a |
| K1-c | KI-04 | Agenten, Läufe, Werkzeug-Registry, Laufprotokoll, Seite Agenten | K1-b |
| K1-d | KI-11 | Wertpotenzial-Finder, Leitprodukt | K1-c, Impact-Ledger, Gemeinsamer Plan |
| K1-e | KI-07 | Agent QBR-Vorbereitung | K1-c |
| K2-a | KI-08 | Agent Marktanalyse | K1, WG-09 |
| K2-b | KI-13 | Strategie-Autor | K2-a, WG-16 |
| K3 | KI-09 | Eigene Agenten | K1, erster Pilot |

Vor K1-a:

- Prüfen, welche KI-Funktionen es schon gibt (zum Beispiel „Fragen“, Erklärung von Feedback-Lücken, Themen aus Freitext). Sie laufen ab KI-01 über das Gateway und werden in KI-04 als Agenten von Reziproq registriert, statt doppelt gebaut zu werden.
- Prüfen, ob die Kennungen KI-01 bis KI-10 frei sind.
- WG-23 durch die angepasste Fassung aus diesem Paket ersetzen: Die Tabellen `ai_draft` und `ai_source` kommen jetzt aus KI-03, die Einstellungen aus KI-01.

Lokal ausprobieren:

- Alles läuft mit dem Anbieter `fake` für Modelle und Websuche, ohne Zugangsdaten und ohne Netzwerk.
- Für echte Läufe Zugangsdaten für Bedrock in der EU als Umgebungsvariablen setzen und den Anbieter auf `bedrock_eu` stellen. Zugangsdaten nie ins Repository.

- KI-11 läuft in K1 für das Marktumfeld nur mit dem Anbieter `fake` für die Websuche, bis ein echter Anbieter gewählt ist. Die internen Potenziale funktionieren ohne ihn.
- Prüfen, ob es im Impact-Ledger schon Hebel-Vorlagen gibt. KI-11 nutzt sie und ergänzt nur fehlende.
- Prüfen, welche Segmente das Modul SEG kennt. KI-11 läuft für die Segmente, die der Admin wählt; die Namen auf dem Canvas sind Beispiele.

Vorlagen für die Oberfläche liegen in `docs/design/referenz/`: `KI-Agenten`, `KI-Lauf`, `KI-Baukasten`, `E-KI`, `KI-Wert`, `KI-Wert-Uebersicht`, `KI-Autor-Start`, `KI-Autor`, dazu `SupplierBar` mit dem Reiter Wertpotenziale und der Link „Als Agent anlegen“ in `Fragen`.
