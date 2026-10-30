# PLT-06 Business Units und Warengruppen

Release 0.1 · Reihenfolge 9 · baut auf PLT-03 und PLT-05

## Ziel

Als Admin pflege ich die Business Units und Warengruppen meines Unternehmens und ordne jeden Lieferanten zu, damit ihn später jede BU getrennt bewerten kann und man nach Warengruppe filtern kann.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | BUs und Warengruppen anlegen, umbenennen, deaktivieren. |
| Käufer: Admin und Nutzer | Lieferanten BUs und Warengruppen zuordnen. |
| Käufer: Leser | Alles sehen und filtern. |
| Lieferant | Sieht nichts davon. BUs und Warengruppen sind käuferprivat. |

## Daten

| Tabelle | Felder | Ebene |
|---|---|---|
| `business_unit` (neu) | `id`, `org_id`, `name`, `code` (optional, eindeutig je Organisation), `active`, `created_at` | `org_private` |
| `material_group` (neu) | `id`, `org_id`, `name`, `code` (optional, eindeutig je Organisation), `parent_id` (optional, höchstens zwei Ebenen), `active` | `org_private` |
| `relationship_business_unit` (neu) | `relationship_id`, `business_unit_id` | `buyer_private` |
| `relationship_material_group` (neu) | `relationship_id`, `material_group_id`, `is_primary` (genau eine je Beziehung, sobald es eine gibt) | `buyer_private` |

- Die Warengruppe gehört zum Kern-Datenmodell (CLAUDE.md). Jede spätere Auswertung kann nach ihr gruppieren.
- Benutzte Einträge werden nie gelöscht, nur deaktiviert. Deaktivierte sind bei neuen Zuordnungen nicht mehr wählbar, bestehende bleiben sichtbar.
- Alle neuen Tabellen stehen im Register aus PLT-04. Änderungen erscheinen im internen Verlauf (PLT-08).

### Beispieldaten (nur lokal)

`pnpm db:seed` ergänzt beim Test-OEM:

- drei BUs (für das 1.0-Kriterium „Test-OEM mit drei BUs“)
- sechs Warengruppen in zwei Ebenen, z. B. Elektronik → Steuergeräte
- die Zuordnung aller 15 Demo-Lieferanten

Beim Zweit-OEM legt es eigene, andere BUs und Warengruppen an.

## Ablauf

1. Admin öffnet **Einstellungen → Business Units** bzw. **Einstellungen → Warengruppen**.
2. Er sieht eine schlichte Liste mit Name, Code, Anzahl zugeordneter Lieferanten und Status. Er legt über einen großen Knopf neue Einträge an und ändert sie per Klick im Dialog.
3. Im Detail-Panel eines Lieferanten (PLT-03) kommen zwei Felder dazu: **Business Units** (Mehrfachauswahl) und **Warengruppen** (Mehrfachauswahl, eine als Haupt-Warengruppe markiert).
4. Die Lieferantenkarten zeigen jetzt die Haupt-Warengruppe.
5. Auf der Lieferantenseite kommen zwei Filter dazu, BU und Warengruppe. Die Suche findet auch Warengruppen.
6. Ohne BUs oder Warengruppen zeigt die Einstellungsseite einen leeren Zustand mit Knopf „Erste Business Unit anlegen“ und dem Hinweis auf den Import (PLT-07).

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Admin legt BUs und Warengruppen an, benennt sie um und deaktiviert sie. Nutzer und Leser bekommen dabei 403.
- [ ] Ein Lieferant lässt sich mehreren BUs und Warengruppen zuordnen. Genau eine Warengruppe ist Haupt-Warengruppe.
- [ ] Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar. Bestehende Zuordnungen bleiben sichtbar und markiert.
- [ ] Ein benutzter Eintrag lässt sich nicht löschen.
- [ ] Codes sind je Organisation eindeutig.
- [ ] Mehr als zwei Ebenen bei Warengruppen werden abgelehnt.
- [ ] Der Zweit-OEM sieht keine BU oder Warengruppe des Test-OEM, der Test-Lieferant keine von beiden (Prüfungen aus PLT-04).
- [ ] Die Filter nach BU und Warengruppe liefern die richtigen Lieferanten.
- [ ] `pnpm db:seed` legt die Beispieldaten ohne Duplikate an.

## Nicht Teil dieser Funktion

- Import von BUs und Warengruppen (PLT-07)
- Standard-Warengruppenkataloge wie eCl@ss oder UNSPSC
- Bewertung je BU (SEG-02)
- Rechte je BU (SEG-02)
