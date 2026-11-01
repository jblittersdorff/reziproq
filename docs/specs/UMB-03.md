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

- [x] Ein Test füllt den Stand vor der Migration, migriert und vergleicht: Keine Warengruppe und kein Spend fehlt.
- [x] `beziehung_kaeufer` existiert danach nicht mehr, und kein Code liest sie.
- [x] Die Prüfungen aus PLT-04 laufen für alle betroffenen Tabellen.
- [x] Ein zweiter Lauf ändert nichts.

## Umgesetzt mit

- **Keine neue Migration:** Die Überführung hat schon PLT-03a erledigt. `0009_beziehungen` überträgt `jahresspend_cent`, `spend_jahr` und `waehrung` nach `relationship_spend` mit `source = import`. `0010_alte_beziehung_entfernen` löscht `beziehung` und `beziehung_kaeufer`.
- **Abweichung:** Der Freitext `warengruppe` wird nicht zu `material_group`. Er entfällt bewusst (Entscheidung zu PLT-03a, nur Demo- und Testdaten). Warengruppen pflegt PLT-06 als Liste. Der Test hält das fest: Aus dem Freitext entstehen keine Warengruppen und keine Zuordnungen.
- **Tests:** `packages/db/src/umb-03.test.ts`.
  - Der Test füllt den Stand vor PLT-03a mit vier Beziehungen bei zwei Käufern, zwei Währungen und einem Spend von 0 Cent, migriert und vergleicht.
  - Er sucht in `apps/` und `packages/` nach Code, der `beziehung_kaeufer` nennt; erlaubt sind nur alte Migrationen und Migrationstests.
  - Er prüft Register, Prüfgerüst und RLS mit FORCE.
  - Er prüft, dass ein zweiter Lauf die Prüfsummen nicht ändert.
- **Protokoll aus dem Testlauf:** 4 von 4 Beziehungen und 4 von 4 Spend-Zeilen überführt, 0 Warengruppen angelegt.

## Nicht Teil dieser Funktion

- Zusammenführen ähnlich geschriebener Warengruppen
