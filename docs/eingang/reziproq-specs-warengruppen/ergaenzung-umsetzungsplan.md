# Ergänzung für umsetzungsplan.md

Release 1.1 Warengruppenmanagement. Die Reihenfolge ist verbindlich, weil spätere Specs auf früheren aufbauen. Jedes Paket ist für sich lauffähig und testbar.

| Paket | Specs | Inhalt | Voraussetzung |
|---|---|---|---|
| 1 | WG-01 | Warengruppen, Produktgruppen, Team, Bezeichnung, Import, Startdaten | Release 1.0 |
| 2 | WG-04, WG-06 | Strategie, Ablauf-Leiste, Seite Warengruppen, Aufsetzen, Ziele | Paket 1 |
| 3 | WG-18 | Bewertungsrunde je Warengruppe, Portfolio-Filter | Paket 1, Modul SEG |
| 4 | WG-07, WG-09, WG-10 | Analysen, Marktanalyse, Bewertung und Hebel, zunächst ohne KI | Pakete 2 und 3 |
| 5 | WG-12, WG-14, WG-15, WG-16 | Scorecard, Review, Vergabeplan, Supplier Map, Freigabe | Paket 4 |
| 6 | WG-20 | Zusammenführung, Widersprüche, Übergaben in den Lieferantenplan | Paket 5 |
| 7 | WG-23 | KI-Entwürfe Stufe 1, danach Stufe 2 | Paket 6 |

Vor Paket 1:

- Die Tabellennamen der Warengruppe und des Moduls SEG im Schema nachsehen und in WG-01 und WG-18 eintragen.
- Prüfen, ob die Kennungen WG-01 bis WG-24 und die Release-Nummer 1.1 frei sind.
- Die Zuordnung der Hebel zu Zieldimensionen in `WG-startdaten.md` nachtragen.

Vorlagen für die Oberfläche liegen in `docs/design`: Canvas-Seite „Warengruppenstrategie (Basis)“ und „Warengruppen zusammengeführt“.
