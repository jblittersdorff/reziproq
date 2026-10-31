# PLB-04 Team beider Seiten

Release 0.2 · baut auf PLT-05, LIF-02 · deckt ab PLB-04, PLB-05

## Ziel

Beide Seiten sehen, wer in der Beziehung welche Rolle hat. Jede Seite pflegt ihr eigenes Team und entscheidet, wen die andere Seite sieht. Die Rolle des SRO ist klar beschrieben.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: SRO, Admin | Das eigene Team pflegen, Sichtbarkeit je Person setzen, Rollenbeschreibung lesen. |
| Lieferant: Admin, Key Account Manager | Das eigene Team pflegen, Sichtbarkeit setzen. |
| Beide Seiten | Die geteilten Mitglieder der anderen Seite sehen. |
| Käufer: Admin | Rollenbeschreibung des SRO in den Einstellungen anpassen. |

## Daten

- `relationship_member` (aus PLT-05) wird zur Tabelle der Art `shared` mit `owner_org_id` (die Seite) und `visibility`. Standard ist `shared` für SRO, Sponsor und Key Account Manager, `internal` für alle anderen.
- Eine Migration überführt bestehende Zeilen. Die Prüfungen aus PLT-04 laufen danach für die neue Art.
- **Teamrollen des Lieferanten:** Key Account Manager (Gegenüber des SRO), Sponsor, Mitglied, Leser.
- **`role_description`** (`org_private`):
  - `org_id`, `role`, `does` (Liste), `does_not` (Liste)
  - Standard für den SRO:
    - **macht:** Strategie, interne Abstimmung, Gesamtblick, langfristige Begleitung von Eskalationen
    - **macht nicht:** Verhandlungen, Engpässe, Claims

## Ablauf

1. **Lieferant › Beziehung › Team** zeigt zwei Spalten, unser Team und das Team des Lieferanten. Jede Person hat Teamrolle, Funktion und Kennzeichen Intern oder Geteilt.
2. Ein Klick auf „SRO“ öffnet die Rollenbeschreibung auf eigener Seite.
3. Jede Seite bearbeitet nur ihre Spalte, auf `/…/team/bearbeiten`.
4. Beim Lieferanten liegt die Seite unter `/kunden/<beziehung>/beziehung/team`, mit gespiegelter Darstellung.
5. **Einstellungen › Rollen** (`/einstellungen/rollen`): Rollenbeschreibungen bearbeiten.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Interne Mitglieder einer Seite sieht die andere Seite nie (PLT-04).
- [ ] Jede Seite kann nur ihr eigenes Team ändern. Versuche an der anderen Seite geben 403.
- [ ] Bis zu zwei Sponsoren je Seite, genau ein SRO auf Käuferseite.
- [ ] Die Migration überführt alle Teams aus PLT-05 ohne Verlust.
- [ ] Teamänderungen stehen im Verlauf, mit der Sichtbarkeit des Mitglieds.
- [ ] Die Rollenbeschreibung ist je Kunde änderbar und erscheint auf der Team-Seite.

## Nicht Teil dieser Funktion

- Kontaktpunkte (PLB-06)
- Einladung (LIF-01)
