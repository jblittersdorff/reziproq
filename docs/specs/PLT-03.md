# PLT-03 Beziehungen und Lieferantenliste

Release 0.1 · Reihenfolge 7 · baut auf PLT-02, PLT-04, PLT-08, PLT-11 · enthält die Lieferantenliste aus der Fassung von PLT-02 vom 29.10.2026

## Ziel

Als Einkäufer lege ich meine Lieferanten an und sehe sie als große Karten. Jeder Lieferant existiert in Reziproq nur einmal, auch wenn mehrere Kunden mit ihm arbeiten, und kein Kunde sieht die Daten eines anderen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Nutzer | Lieferanten sehen, suchen, sortieren, Detail-Panel öffnen. |
| Käufer: anlegen, ändern, beenden | Bis PLT-05 jeder Käufer-Nutzer. Ab PLT-05 nur Admin und Nutzer, nicht Leser. |
| Lieferant | Sieht die Beziehung erst, wenn sie aktiv ist (ab LIF-01). Dann sieht er nur Name und Land des Kunden und seine eigene Seite, nie Spend oder die Einstellungen des Käufers. |
| Andere Käufer | Sehen nicht, dass eine Beziehung besteht. |

## Daten

| Tabelle | Felder | Ebene |
|---|---|---|
| `relationship` (neu) | `id`, `buyer_org_id`, `supplier_org_id`, `status` (`draft`, `active`, `ended`), `created_at`, `ended_at`. Paar Käufer und Lieferant eindeutig. | shared, mit Verlauf (PLT-08) |
| `relationship_side` (neu) | `relationship_id`, `org_id`, `display_name` (wie diese Seite die andere nennt), `external_ref` (eigene Lieferanten- bzw. Kundennummer), `notes` | `org_private`: Die Käuferzeile sieht nur der Käufer, die Lieferantenzeile nur der Lieferant. |
| `relationship_spend` (neu) | `relationship_id`, `year`, `amount_cents` (ganze Zahl), `currency` (Standard EUR), `source` (`manual`, `import`, `seed`) | `buyer_private` |

- **Ein Lieferant existiert einmal:** Beim Anlegen sucht die API nach einer Organisation mit derselben USt-IdNr. oder D-U-N-S-Nummer. Gibt es eine, entsteht nur eine neue Beziehung zu ihr. Gibt es keine, entsteht eine neue Organisation ohne Nutzer und ohne Feature `buyer`.
- **Keine Namensvorschläge über Kunden hinweg:** Die Suche nach Namen fremder Organisationen würde verraten, mit wem andere Kunden arbeiten. Zusammengeführt wird nur über eindeutige Nummern. Doppelte Organisationen ohne Nummer führt später das Reziproq-Team zusammen.
- Eine Beziehung wird nie gelöscht, nur beendet. Der Verlauf bleibt.
- Mit dem Status `draft` weiß der Lieferant noch nichts. Er sieht nichts, bis die Beziehung `active` ist (LIF-01).
- Spend ist kein Segment. Diese Funktion zeigt und leitet kein Segment ab.

### Beispieldaten (nur lokal)

`pnpm db:seed` ergänzt:

- 15 Lieferanten mit erfundenen Namen, alle mit der Endung „(Demo)“, mit Land, USt-IdNr. im gültigen Format und Spend für zwei Jahre, als Beziehungen zum Test-OEM
- Drei davon zusätzlich als Beziehungen zum Zweit-OEM, mit anderem Spend und anderer eigener Nummer
- Den Test-Lieferanten (Demo) als Beziehung zu beiden OEMs, Status `draft`

## Ablauf

1. Der Nutzer öffnet **Lieferanten** über die Seitenleiste oder die Kachel.
2. Oben stehen Titel, Anzahl der Lieferanten, Gesamtspend des letzten vollen Jahres und rechts ein großer Knopf **Lieferant hinzufügen**.
3. Darunter folgen ein großes Suchfeld und eine Sortierung: Spend absteigend (Standard) oder Name.
4. Die Lieferanten erscheinen als Karten mit Name, Land, eigener Lieferantennummer und Spend des letzten Jahres in Euro (de-DE, ohne Nachkommastellen).
5. **Lieferant hinzufügen** öffnet einen Dialog mit:
   - Name (Pflicht)
   - Land (Pflicht, Auswahl)
   - USt-IdNr. (optional, mit Formatprüfung)
   - D-U-N-S (optional, neun Ziffern)
   - eigene Lieferantennummer (optional)
   - Spend und Jahr (optional)
6. Gibt es die Organisation schon (gleiche USt-IdNr. oder D-U-N-S), sagt der Dialog nur „Lieferant ist bereits in Reziproq und wird verknüpft.“ Er nennt keine anderen Kunden.
7. Ein Klick auf eine Karte öffnet rechts ein **Detail-Panel** mit:
   - Stammdaten
   - eigener Nummer und Notizen (käuferprivat)
   - Spend je Jahr (bearbeitbar)
   - Status
   - Verlauf (Baustein aus PLT-08)
   - Knopf **Beziehung beenden**, mit Bestätigung
8. Beendete Beziehungen verschwinden aus der Liste. Ein Filter „Beendete zeigen“ holt sie zurück.
9. Ohne Lieferanten erscheint ein leerer Zustand: „Noch keine Lieferanten. Füge den ersten hinzu oder importiere eine Liste.“ Dazu zwei Knöpfe. Der Import-Knopf wird mit PLT-07 aktiv.
10. Auf der Übersicht zeigt die Kachel „Lieferanten“ jetzt Anzahl und Gesamtspend statt des Release-Hinweises.

### Gestaltung

- Gleiche Kachel-Optik wie auf der Übersicht, kleiner: drei bis vier Spalten breit, eine Spalte schmal.
- Der Name ist die größte Schrift der Karte, der Spend steht gut lesbar unten.
- Dialog und Panel aus dem Styleguide (PLT-10).

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Zwei Käufer legen einen Lieferanten mit derselben USt-IdNr. an. Es gibt danach eine Organisation und zwei Beziehungen.
- [ ] Ohne USt-IdNr. und D-U-N-S entsteht immer eine neue Organisation, und kein Dialog nennt fremde Organisationen.
- [ ] Der Zweit-OEM sieht beim gemeinsamen Lieferanten weder Spend noch eigene Nummer oder Notizen des Test-OEM. Die Prüfungen aus PLT-04 laufen für alle drei neuen Tabellen.
- [ ] Ein Nutzer des Test-Lieferanten sieht Beziehungen im Status `draft` nicht.
- [ ] Anlegen, Ändern und Beenden erzeugen Verlaufseinträge. Spend und Notizen tauchen nicht in geteilten Verlaufseinträgen auf.
- [ ] Spend steht in Cent in der Datenbank und erscheint als Euro im deutschen Format.
- [ ] Anzahl und Gesamtspend oben und auf der Kachel stimmen mit der Datenbank überein.
- [ ] Suche (Name, eigene Nummer) und Sortierung (Spend, Name) funktionieren.
- [ ] Eine beendete Beziehung bleibt in der Datenbank, verschwindet aus der Standardliste und erscheint mit Filter wieder.
- [ ] Pflichtfelder und Formate werden im Dialog und in der API geprüft (zod in `packages/shared`).
- [ ] `pnpm db:seed` legt die Beispieldaten ohne Duplikate an.

## Nicht Teil dieser Funktion

- Business Units und Warengruppen (PLT-06)
- Import per Excel oder CSV (PLT-07)
- Lieferanten einladen und Beziehung aktivieren (LIF-01)
- Team und SRO je Beziehung (PLT-05 und PLB-03)
- Segment, Bewertung, Matrix (SEG-01 bis SEG-05)
- Volle Lieferanten-Detailseite (SEG-06). Das Panel wird dort zur eigenen Seite.
- Zusammenführen doppelter Organisationen
