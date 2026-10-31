# PLT-06 Business Units und Warengruppen

Release 0.1 · baut auf PLT-03, PLT-05 · überarbeitet am 31.10.2026: eigene Seiten statt Dialog

## Ziel

Als Admin pflege ich die Business Units und Warengruppen meines Unternehmens und ordne jeden Lieferanten zu. So kann ihn später jede BU getrennt bewerten, und man kann nach Warengruppe filtern.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | BUs und Warengruppen anlegen, umbenennen, deaktivieren. |
| Käufer: Admin und Nutzer | Lieferanten BUs und Warengruppen zuordnen. |
| Käufer: Leser | Alles sehen. |
| Lieferant | Sieht nichts davon. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `business_unit` | `id`, `org_id`, `name`, `code` (eindeutig je Organisation), `active`, `created_at` | `org_private` |
| `material_group` | `id`, `org_id`, `name`, `code` (eindeutig je Organisation), `parent_id` (höchstens zwei Ebenen), `active` | `org_private` |
| `relationship_business_unit` | `relationship_id`, `business_unit_id` | `buyer_private` |
| `relationship_material_group` | `relationship_id`, `material_group_id`, `is_primary` (genau eine je Beziehung) | `buyer_private` |

- Benutzte Einträge werden nur deaktiviert, nie gelöscht.
- **Beispieldaten beim Test-OEM:** drei BUs, sechs Warengruppen in zwei Ebenen, Zuordnung aller Demo-Lieferanten.
- **Beispieldaten beim Zweit-OEM:** eigene, andere Werte.

## Ablauf

1. **Einstellungen › Business Units** (`/einstellungen/business-units`):
   - Liste mit Name, Code, Anzahl Lieferanten und Status
   - **Neu** führt zu `/…/neu`.
   - Ein Klick auf einen Eintrag führt zu `/…/<id>/bearbeiten`, dort auch Deaktivieren mit Bestätigung auf der Seite.
2. **Einstellungen › Warengruppen** funktioniert genauso, mit Oberebene als Auswahl.
3. **Lieferant › Strategie › Profil** bekommt den Abschnitt **Zuordnung** mit BUs und Warengruppen. Eine Warengruppe ist als Haupt-Warengruppe markiert. Bearbeitet wird auf `/…/profil/zuordnung`.
4. Die Lieferantenkarten zeigen die Haupt-Warengruppe. Die Suche findet auch Warengruppen.
5. **Leerer Zustand:** „Erste Business Unit anlegen“, mit Hinweis auf den Import.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Admin legt an, benennt um und deaktiviert. Nutzer und Leser bekommen dabei 403.
- [ ] Mehrere BUs und Warengruppen je Lieferant, genau eine Haupt-Warengruppe.
- [ ] Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar. Bestehende bleiben sichtbar und markiert.
- [ ] Ein benutzter Eintrag lässt sich nicht löschen.
- [ ] Codes sind je Organisation eindeutig. Mehr als zwei Ebenen werden abgelehnt.
- [ ] Der Zweit-OEM und der Test-Lieferant sehen keine BU und keine Warengruppe des Test-OEM (PLT-04).
- [ ] Alle Formulare sind eigene Seiten. Speichern und Abbrechen führen zurück.

## Nicht Teil dieser Funktion

- Import von BUs (PLT-07)
- Filter in der Lieferantenliste (NAV-12)
- Standardkataloge wie eCl@ss
- Bewertung je BU (SEG-04)
