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
