# PLT-02 Organisationen und Lieferantenliste

Release 0.1 · enthält die Grundlage von PLT-03 (Beziehung als Datensatz) und PLT-04 (Datentrennung)

## Ziel

Als Einkäufer sehe ich alle Lieferanten meines Unternehmens als übersichtliche Karten mit Warengruppe und Spend, und kein anderes Unternehmen sieht diese Daten.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin, Nutzer, Leser, Controlling | Lieferantenliste der eigenen Organisation sehen, suchen, sortieren. |
| Käufer: alle Rollen | Nichts ändern. Anlegen und Ändern kommt mit dem Import (PLT-07) und der Pflege (PLT-06). |
| Lieferant | Sieht nichts aus dieser Funktion. Warengruppe und Spend sind käuferprivat und werden nie geteilt. |
| Nutzer ohne Organisation | Sieht nur einen Hinweis, dass er noch keiner Organisation zugeordnet ist. |

## Daten

| Tabelle | Felder | Ebene |
|---|---|---|
| `organization` (erweitern) | `typ` (Käufer oder Lieferant), `land` (ISO-Code) | Stammdaten der Organisation |
| `app_user` (erweitern) | `organization_id`, leer erlaubt | Jeder Nutzer gehört zu höchstens einer Organisation |
| `beziehung` (neu) | `id`, `kaeufer_org_id`, `lieferant_org_id`, `created_at`. Paar eindeutig. | Grundlage für PLT-03 |
| `beziehung_kaeufer` (neu) | `beziehung_id`, `warengruppe` (Text, bis PLT-06 eine Liste bringt), `jahresspend_cent` (ganze Zahl), `spend_jahr`, `waehrung` (EUR) | **käuferprivat** |

- Ein Lieferant existiert genau einmal als Organisation und kann mehreren Käufern zugeordnet sein.
- Beträge werden immer in Cent als ganze Zahl gespeichert und erst in der Oberfläche als Euro angezeigt.
- RLS auf `beziehung` und `beziehung_kaeufer`: Ein Käufer-Nutzer sieht nur Zeilen mit seiner `kaeufer_org_id`.
- Spend ist kein Segment. Diese Funktion zeigt kein Segment und leitet keins aus dem Spend ab.

### Beispieldaten (nur lokal)

- Skript `pnpm db:seed`.
- Legt eine Käuferorganisation „Beispiel-OEM (Demo)“ an.
- Legt einen zweiten Käufer „Zweit-OEM (Demo)“ an, um die Datentrennung zu zeigen.
- Legt 15 Lieferanten mit erfundenen Namen an, alle mit der Endung „(Demo)“. Sie verteilen sich auf Länder und auf Warengruppen wie Elektronik, Guss, Kunststoff und Logistik.
- Legt Beziehungen mit Warengruppe und Spend an. Drei Lieferanten sind auch dem Zweit-OEM zugeordnet, mit anderen Werten.
- Ordnet alle vorhandenen Nutzer dem Beispiel-OEM zu.
- Läuft mehrfach ohne doppelte Einträge.
- Bricht ab, wenn `NODE_ENV=production`.

## Ablauf

1. Der Nutzer öffnet **Lieferanten** über Seitenleiste oder Kachel.
2. Oben stehen Titel, Anzahl der Lieferanten und Gesamtspend, darunter ein großes Suchfeld.
3. Darunter folgen die Lieferanten als große Karten. Jede Karte zeigt Name, Land, Warengruppe und Jahresspend in Euro (de-DE, ohne Nachkommastellen).
4. Die Suche filtert schon beim Tippen nach Name und Warengruppe.
5. Sortieren nach Name oder Spend über ein einfaches Auswahlmenü. Standard ist Spend, absteigend.
6. Ohne Lieferanten erscheint ein leerer Zustand: „Noch keine Lieferanten. Mit dem Import (kommt in Release 0.1) lädst du sie aus Excel.“
7. Auf der Übersicht zeigt die Kachel „Lieferanten“ jetzt Anzahl und Gesamtspend statt des Release-Hinweises.
8. Ein Nutzer ohne Organisation sieht auf allen Seiten den Hinweis „Du bist noch keiner Organisation zugeordnet. Wende dich an deinen Admin.“

### Gestaltung

- Gleiche Kachel-Optik wie auf der Übersicht (PLT-11), aber kleiner: drei bis vier Spalten auf breiten Bildschirmen, eine Spalte auf schmalen.
- Spend rechtsbündig und gut lesbar, Name als größte Schrift der Karte.
- Kein Klick auf Karten in dieser Funktion. Die Detailseite kommt mit SEG-06.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Die Migration legt die Felder und Tabellen aus „Daten“ an und läuft auf leerer und bestehender Datenbank.
- [ ] `pnpm db:seed` legt beide Käufer, 15 Lieferanten und die Beziehungen an. Ein zweiter Lauf erzeugt keine Duplikate.
- [ ] `pnpm db:seed` bricht bei `NODE_ENV=production` ab.
- [ ] `GET /suppliers` liefert nur Lieferanten der eigenen Organisation, ohne Login 401.
- [ ] Datentrennung: Ein Nutzer des Zweit-OEM sieht beim selben Lieferanten nur seine eigenen Werte, nie die des Beispiel-OEM, und umgekehrt.
- [ ] RLS greift auch direkt in der Datenbank: Eine Abfrage ohne gesetzte Organisation liefert keine Zeilen.
- [ ] Die Seite zeigt Karten mit Name, Land, Warengruppe und Spend. Anzahl und Gesamtspend oben stimmen mit der Datenbank überein.
- [ ] Die Suche filtert nach Name und Warengruppe. Die Sortierung nach Name und Spend funktioniert.
- [ ] Beträge stehen in Cent in der Datenbank und erscheinen als Euro im deutschen Format.
- [ ] Die Kachel „Lieferanten“ auf der Übersicht zeigt Anzahl und Gesamtspend.
- [ ] Ein Nutzer ohne Organisation sieht den Hinweis statt eines Fehlers.
- [ ] Leere Liste zeigt den leeren Zustand.

## Nicht Teil dieser Funktion

- Lieferanten anlegen, ändern oder löschen in der Oberfläche
- Import per Excel oder CSV (PLT-07)
- Business Units und Warengruppen als gepflegte Listen (PLT-06)
- Segment, Bewertung und Matrix (SEG-01 bis SEG-05)
- Lieferanten-Detailseite (SEG-06)
- Zugang für Lieferanten-Nutzer (Release 0.2)
- Einstellungen der Beziehung je Seite (Rest von PLT-03)
