# PLT-03 Beziehungen und Lieferantenliste

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: BZ-01, AK-01. Das Datenmodell der Beziehung gilt weiter; Liste und Seiten nach BZ-01 unter `/beziehungen`. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.1 · baut auf PLT-02, PLT-04, PLT-08, PLT-11 · überarbeitet am 31.10.2026: Seiten statt Dialog und Panel

## Ziel

Als Einkäufer lege ich meine Lieferanten an und sehe sie als große Karten. Jeder Lieferant existiert in Reziproq nur einmal, auch wenn mehrere Kunden mit ihm arbeiten, und kein Kunde sieht die Daten eines anderen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Nutzer | Lieferanten sehen, suchen, sortieren, Seiten eines Lieferanten öffnen. |
| Käufer: anlegen, ändern, beenden | Bis PLT-05 jeder Käufer-Nutzer. Ab PLT-05 nur Admin und Nutzer. |
| Lieferant | Sieht die Beziehung erst, wenn sie aktiv ist (LIF-01). Dann sieht er nur Name und Land des Kunden, nie Spend oder die Einstellungen des Käufers. |
| Andere Käufer | Sehen nicht, dass eine Beziehung besteht. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `relationship` | `id`, `buyer_org_id`, `supplier_org_id`, `status` (`draft`, `active`, `ended`), `created_at`, `ended_at`. Das Paar ist eindeutig. | `shared`, mit Verlauf |
| `relationship_side` | `relationship_id`, `org_id`, `display_name`, `external_ref` (eigene Lieferanten- bzw. Kundennummer), `notes`, `is_focus`, `focus_reason` (beide gesetzt ab SEG-02) | `org_private` |
| `relationship_spend` | `relationship_id`, `year`, `amount_cents` (Ganzzahl), `currency` (Standard EUR), `source` (`manual`, `import`, `seed`) | `buyer_private` |

- **Ein Lieferant existiert einmal.** Beim Anlegen sucht die API eine Organisation mit derselben USt-IdNr. oder D-U-N-S-Nummer. Gibt es sie, entsteht nur eine neue Beziehung. Sonst entsteht eine neue Organisation ohne Nutzer.
- **Keine Namensvorschläge über Kunden hinweg.** Sonst würde sichtbar, mit wem andere Kunden arbeiten.
- Beziehungen werden nie gelöscht, nur beendet.
- Spend ist kein Segment.

**Beispieldaten:** `pnpm db:seed` legt an:

- 15 Demo-Lieferanten mit Land, USt-IdNr. und Spend für zwei Jahre, alle beim Test-OEM
- drei davon zusätzlich beim Zweit-OEM, mit anderen Werten
- den Test-Lieferanten bei beiden OEMs, im Status `draft`

## Teilung

Zwei Pull Requests:

- **PLT-03a** (braucht PLT-04, PLT-11): neues Datenmodell, Migration aus `beziehung` und `beziehung_kaeufer`, Seed, Liste mit Kennzahlen.
- **PLT-03b** (braucht PLT-03a, PLT-08): Anlegen, Bearbeiten, Beenden, Profil- und Spend-Seiten mit Verlauf.

## Ablauf

1. **Lieferanten** (`/lieferanten`):
   - Oben stehen Titel, Anzahl, Gesamtspend des letzten vollen Jahres und der Knopf **Lieferant hinzufügen**.
   - Darunter stehen Suche (Name, eigene Nummer) und Sortierung (Spend absteigend oder Name).
   - Die Karten zeigen Name, Land, eigene Nummer und Spend des letzten Jahres.
2. **Lieferant hinzufügen** öffnet die Seite `/lieferanten/neu` mit diesen Feldern:
   - Name und Land (Pflicht)
   - USt-IdNr. und D-U-N-S
   - eigene Nummer
   - Spend und Jahr

   Gibt es die Organisation schon, steht dort nur: „Lieferant ist bereits in Reziproq und wird verknüpft.“ Nach dem Speichern führt die Seite zum neuen Lieferanten.
3. Ein Klick auf eine Karte öffnet `/lieferanten/<id>`. Den Rahmen mit lokaler Leiste baut NAV-06. Diese Spec liefert zwei Seiten:
   - **Strategie › Profil** (`/lieferanten/<id>/strategie/profil`):
     - Stammdaten, eigene Nummer, Notizen, Status, Verlauf (PLT-08)
     - Bearbeiten auf `/…/profil/bearbeiten`
     - **Beziehung beenden** mit Bestätigung auf der Seite
   - **Strategie › Spend** (`/lieferanten/<id>/strategie/spend`):
     - Spend je Jahr als Liste
     - Jahr hinzufügen oder ändern auf eigener Seite
4. Beendete Beziehungen verschwinden aus der Liste. Der Filter „Beendete zeigen“ holt sie zurück.
5. **Leerer Zustand:** „Noch keine Lieferanten. Füge den ersten hinzu oder importiere eine Liste.“ Der Import-Knopf wird mit PLT-07 aktiv.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Zwei Käufer legen einen Lieferanten mit derselben USt-IdNr. an. Danach gibt es eine Organisation und zwei Beziehungen.
- [x] Ohne USt-IdNr. und D-U-N-S entsteht eine neue Organisation, und keine Seite nennt fremde Organisationen.
- [x] Der Zweit-OEM sieht beim gemeinsamen Lieferanten weder Spend noch eigene Nummer oder Notizen des Test-OEM. Die Prüfungen aus PLT-04 laufen für alle drei Tabellen.
- [x] Ein Nutzer des Test-Lieferanten sieht Beziehungen im Status `draft` nicht.
- [x] Anlegen, Ändern und Beenden erzeugen Verlaufseinträge, ohne Spend oder Notizen in geteilten Einträgen.
- [x] Spend liegt in Cent in der Datenbank und erscheint als Euro im deutschen Format.
- [x] Anzahl und Gesamtspend stimmen mit der Datenbank überein.
- [x] Suche, Sortierung und der Filter „Beendete zeigen“ funktionieren und stehen in der Adresse. Seit BZ-01 (K2-b.4) ohne eigene Suche (Frag Reziproq übernimmt); Sortierung nach Aufmerksamkeit oder Spend, „Beendete zeigen“ unter „Mehr Filter“.
- [x] Anlegen, Bearbeiten und Spend-Erfassung laufen über eigene Seiten. Speichern und Abbrechen führen zurück.
- [x] Pflichtfelder und Formate werden auf der Seite und in der API geprüft (zod in `packages/shared`).

## Umgesetzt mit (PR zu PLT-03a)

Entscheidungen beim Bauen, abgestimmt vor der Umsetzung:

- `relationship` steht im Register als `shared`, aber mit Policies von Hand: Sie ist der Anker aller Beziehungsdaten und hat keine Spalten `relationship_id`, `owner_org_id` und `visibility`. Der Käufer sieht alle seine Beziehungen, der Lieferant nur aktive im Kontext dieses Kunden (`app.customer_org_id`). Die automatischen Prüfungen aus PLT-04 laufen für `relationship_side` und `relationship_spend`; `relationship` hat eigene Tests (`packages/db/src/plt-03a.test.ts`).
- Die Prüffunktionen aus PLT-04 lesen `relationship`; „aktiv“ heißt `status = 'active'`. Name und Land eines Kunden sieht der Lieferant erst, wenn die Beziehung kein Entwurf mehr ist.
- Bestandsdaten: `beziehung` wird zu `relationship` (mit `ended_at` → `ended`, sonst `active`), Spend aus `beziehung_kaeufer` zu `relationship_spend` mit `source = import`. Der Freitext Warengruppe entfällt; Warengruppen kommen mit PLT-06. Die KI-Suche filtert deshalb nach Name, eigener Nummer, Land und Spend.
- „Letztes volles Jahr“ ist das Kalenderjahr vor heute. Anzahl und Gesamtspend zählen alle nicht beendeten Beziehungen, auch Entwürfe.
- Name auf der Karte: `display_name` der eigenen Seite, sonst der Name der Organisation.
- Adresse der Liste: `/lieferanten?suche=…&sortierung=name&beendet=1`.
- Der Knopf „Lieferant hinzufügen“ und die Seite `/lieferanten/neu` kommen zusammen mit PLT-03b; der leere Zustand nennt den nächsten Schritt ohne Knopf.

## Umgesetzt mit (PR zu PLT-03b)

Entscheidungen beim Bauen, abgestimmt vor der Umsetzung:

- Anlegen, Ändern und Beenden dürfen schon jetzt nur Admin und Nutzer (`can(…, 'lieferanten.bearbeiten')`, in `/me` als `editSuppliers`). PLT-05 ändert daran nichts.
- Verlauf: Die Beziehung ist geteilt und trägt nur den Status (`created`, `ended`). Eigene Werte (Anzeigename, eigene Nummer, Notizen) und Spend haben einen internen Verlauf, den nur die eigene Organisation sieht. Die Profilseite zeigt beides zusammen.
- Stammdaten der Lieferanten-Organisation (Name, Land, USt-IdNr., D-U-N-S) ändern Käufer nicht; sie stehen auf dem Profil nur zum Lesen. Bearbeiten ändert den Namen in der eigenen Liste, die eigene Nummer und Notizen.
- Der Hinweis „Lieferant ist bereits in Reziproq und wird verknüpft.“ erscheint nach dem Verlassen von USt-IdNr. oder D-U-N-S. Die API antwortet nur mit ja oder nein (`GET /api/suppliers/lookup`).
- Finden oder Anlegen der Organisation läuft über eng gefasste Datenbankfunktionen der Rolle `reziproq_stammdaten` (`app_lieferant_bekannt`, `app_lieferant_finden_oder_anlegen`), nur für Organisationen mit Feature `buyer`. Sie geben nie Name oder Land einer fremden Organisation zurück.
- Neue Beziehungen beginnen als `draft`; `active` setzt erst LIF-01.
- `/lieferanten/<id>` führt bis NAV-06 zum Profil.

Kriterien aus PLT-03a: Datentrennung zwischen den OEMs (mit den PLT-04-Prüfungen), Entwurf für den Lieferanten unsichtbar, Spend in Cent und als Euro im deutschen Format, Anzahl und Gesamtspend, Suche, Sortierung und „Beendete zeigen“ in der Adresse. Die übrigen Kriterien gehören zu PLT-03b.

## Nicht Teil dieser Funktion

- Lokale Leiste, Kopf und Überblick des Lieferanten (NAV-06)
- Business Units und Warengruppen (PLT-06)
- Import (PLT-07)
- Filter nach BU, Warengruppe, Segment und Fokus (NAV-12)
- Spend als Diagramm (SPL-04)
- Profil mit Finanzkennzahlen (SPL-05)
- Lieferanten einladen (LIF-01)
