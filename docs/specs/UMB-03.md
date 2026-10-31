# UMB-03 Bestandsdaten in die neuen Tabellen überführen

Release 1.0 (Kernpfad) · baut auf PLT-03b, PLT-06

## Ziel

Nach dem Umbau fehlt nichts: Warengruppen und Spend der bestehenden Beziehungen stehen an ihrem neuen Ort, und keine Information liegt doppelt.

## Wer darf was

Keine Oberfläche.

## Daten

- Der Freitext `beziehung_kaeufer.warengruppe` wird je Organisation zu `material_group` (Name wie bisher, Code aus dem Namen) und über `relationship_material_group` mit `is_primary = true` zugeordnet.
- `jahresspend_cent` und `spend_jahr` werden zu `relationship_spend` mit `source = import`, falls PLT-03a sie noch nicht übernommen hat.
- Danach entfällt `beziehung_kaeufer`.

## Ablauf

Eine Migration, idempotent, mit Protokoll der überführten Zeilen im Pull Request.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Test füllt den Stand vor der Migration, migriert und vergleicht: Keine Warengruppe und kein Spend fehlt.
- [ ] `beziehung_kaeufer` existiert danach nicht mehr, und kein Code liest sie.
- [ ] Die Prüfungen aus PLT-04 laufen für alle betroffenen Tabellen.
- [ ] Ein zweiter Lauf ändert nichts.

## Nicht Teil dieser Funktion

- Zusammenführen ähnlich geschriebener Warengruppen
