# PLB-01 Kataloge für Spielregeln und Formate

Release 0.2 · baut auf SEG-01 · deckt ab PLB-01, PLB-02

## Ziel

Als Admin lege ich fest, welche Rechte und Pflichten und welche Formate der Zusammenarbeit zu jedem Beziehungstyp passen. Jedes Recht für den Lieferanten steht einer Pflicht gegenüber.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Kataloge ändern. |
| Käufer: alle | Kataloge sehen. |
| Lieferant | Sieht nur die für seine Beziehung freigegebenen Spielregeln (SEG-10). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `rule_catalog_item` | `id`, `org_id`, `kind` (`right`, `obligation`), `group` (`cost`, `protection`, `collaboration`, `growth`), `title`, `description`, `counterpart_id` (die passende Pflicht bzw. das passende Recht), `min_impact_level` (1 bis 3) | `org_private` |
| `format_catalog_item` | `id`, `org_id`, `name`, `purpose`, `level` (Geschäftsleitung, Management, Fachebene), `cadence` (monatlich, quartalsweise, halbjährlich, jährlich, nach Bedarf), `min_impact_level`, `for_quality_levels` (z. B. nur bei schwacher Beziehung) | `org_private` |

- **Zuordnung zum Typ:** Ein Eintrag gilt für alle Typen mit Impact-Stufe ab `min_impact_level`. So bekommen Beziehungen mit hohem Business Impact mehr Rechte, Pflichten und Formate.
- **Standardkatalog** als Datei `packages/db/seed/catalog.de.json` und `.en.json`, beim Anlegen einer Käuferorganisation kopiert:

| Gruppe | Recht des Lieferanten | Gegenpflicht |
|---|---|---|
| Kosten | Mehrjährige Preisvereinbarung mit Gleitklausel | Offene Kostenstruktur für vereinbarte Teile |
| Kosten | Gemeinsame Kostenworkshops | Jährliches Produktivitätsangebot |
| Absicherung | Längerer Bedarfsausblick | Verbindliche Kapazitätszusage |
| Absicherung | Frühe Information über Programmänderungen | Frühwarnung bei Lieferrisiken |
| Zusammenarbeit | Zugang zur Geschäftsleitung | Fester Ansprechpartner auf Geschäftsleitungsebene |
| Zusammenarbeit | Schnellere Freigabeprozesse | Teilnahme am beidseitigen Feedback |
| Wachstum | Frühe Einbindung in neue Entwicklungen | Innovationen zuerst anbieten |
| Wachstum | Einblick in die Technologie-Roadmap | Investition in gemeinsame Entwicklungsziele |

- **Standardformate:** Strategiedialog der Geschäftsleitungen, Quartalsreview, Joint Business Planning, beidseitiges Feedback, Innovationstag, Workshop zur Wertschöpfungskette, Neustart der Beziehung (nur bei schwacher Beziehungsqualität).

## Ablauf

1. **Einstellungen › Spielregeln** (`/einstellungen/spielregeln`) zeigt zwei Kacheln: Rechte und Pflichten, Formate.
2. **Rechte und Pflichten:**
   - Die Liste ist nach Gruppe geordnet, jedes Recht steht neben seiner Gegenpflicht.
   - Neu und Bearbeiten öffnen eigene Seiten.
   - Ein Recht ohne Gegenpflicht zeigt eine Warnung.
3. **Formate:** Liste mit Ebene, Takt und den Typen, für die das Format gilt. Bearbeitet wird auf eigener Seite.
4. **Vorschau je Typ** (`/einstellungen/spielregeln/typ/<impact>-<quality>`) zeigt, was ein Lieferant dieses Typs bekäme.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jede neue Käuferorganisation hat den Standardkatalog auf Deutsch und Englisch.
- [ ] Die Vorschau zeigt für jeden der neun Typen die richtigen Einträge nach `min_impact_level` und `for_quality_levels`.
- [ ] Ein Recht ohne Gegenpflicht zeigt eine Warnung und lässt sich trotzdem speichern.
- [ ] Nur Admins ändern. Der Zweit-OEM sieht den Katalog des Test-OEM nicht.

## Nicht Teil dieser Funktion

- Spielregeln je Beziehung (PLB-03)
- Freigabe an den Lieferanten (SEG-10)
