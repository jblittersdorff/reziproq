# Ergänzung für rechte.md

| Objekt | Admin | Besitzer eines eigenen Agenten | SRO der Beziehung | Käufer mit Zugriff | Lieferant |
|---|---|---|---|---|---|
| Einstellungen KI | schreiben | lesen | lesen | Kontingent lesen | nie |
| Verbrauch je Agent | lesen | eigene Agenten lesen | lesen | nie | nie |
| Agent von Reziproq | ein- und ausschalten | lesen, starten | lesen, starten | lesen, starten | nie |
| Eigener Agent | freigeben, pausieren | schreiben, testen, löschen | lesen, starten | lesen, starten, wenn die Daten sichtbar sind | nie |
| Lauf und Protokoll | alle lesen | eigene lesen | Läufe zu seinen Beziehungen lesen | eigene lesen | nie |
| Entwurf | lesen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie |
| Wertpotenzial, Rechenweg, Marktsignal, Datenlücke | lesen | – | übernehmen, verwerfen, Annahmen ändern | lesen, wenn Zugriff auf die Beziehung | nie |
| Frage an das Team | lesen | – | – | beantworten, wenn an sie gerichtet; Lead und Commodity Manager alle | nie |

Für alle Tabellen aus KI-01 bis KI-13 gilt:

- Art `org_private`, keine Freigabe-Policy.
- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.
- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.
- Ein Werkzeug liefert nie mehr, als die Person sehen darf, in deren Namen der Lauf handelt.

Ergänzung ab KI-15:

| Objekt | Admin | Lead | Commodity Manager | SRO der Beziehung | Käufer mit Zugriff | Controlling | Lieferant |
|---|---|---|---|---|---|---|---|
| Import, Alias, Regel | schreiben, rückgängig | lesen | Prüfung für eigene Warengruppen | – | – | – | nie |
| Hinweis (Ergänzung zu FS-01) | Regeln und Schwellen | alle lesen | eigene Warengruppen bearbeiten | eigene Beziehungen bearbeiten | – | – | nie |
| Ergebnisse nach dem Termin | – | – | – | übernehmen, Protokoll teilen | Teilnehmer: erfassen, lesen | – | nur geteiltes Protokoll und geteilte Zusagen |
| Dokument, Feld | löschen | lesen | eigene Warengruppen schreiben, bestätigen | schreiben, bestätigen | lesen | – | nie |
| Vertragsleck, Bestellzeile, Gutschrift | lesen | lesen | eigene Warengruppen lesen | klären, Rückfluss erfassen | – | Rückfluss bestätigen | nur gesendete Klärung |
| Szenario | lesen | entscheiden | eigene Warengruppen schreiben, entscheiden | schreiben, entscheiden ohne Warengruppe | lesen | – | nie |
| Verhandlungsplan, Probe | – | lesen | – | schreiben | nur Mitglieder | – | nie |
| Quartalsbericht | anlegen | anlegen, freigeben, exportieren | lesen | lesen | freigegebene lesen | freigegebene lesen | nie |
| Hilfe für Lieferanten | ein- und ausschalten, Verbrauch je Lieferant | – | – | – | – | – | eigene Läufe und Entwürfe |
