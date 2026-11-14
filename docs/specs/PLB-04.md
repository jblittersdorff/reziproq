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

## Umsetzung

- `relationship_member` ist geteilt: `owner_org_id` ist die Seite, `visibility` intern oder geteilt.
  Ein Trigger (`app_team_member_fill`, Rolle `reziproq_team`) füllt fehlende Seite und
  `member_name` beim Einfügen, auch für Zeilen aus der Annahme einer Einladung (LIF-01).
  `member_name` ist ein Schnappschuss des Namens, weil die andere Seite `app_user` nicht lesen darf.
- Der Fremdschlüssel auf `app_user` entfällt (keine Fremdschlüssel von geteilten auf private
  Tabellen); die Migration überführt alle Zeilen, SRO und Sponsoren werden geteilt.
- Der Lieferant nutzt dieselben Teamrollen; `sro` heißt dort Key Account Manager. Endpunkte:
  `/suppliers/<beziehung>/team` beim Käufer, `/kunden/<beziehung>/team` beim Lieferanten. Jede
  Seite löscht und schreibt nur Zeilen der eigenen Organisation.
- Recht `team.festlegen` haben Admin und Nutzer; der Dienst lässt nur Admins und den SRO bzw. KAM
  der Beziehung ändern. Ein Admin darf auch mit Teamrolle Leser.
- Die Teamseite zeigt das Kennzeichen am Namen, damit die Tabelle auch schmal drei Spalten hat.
  `role_description` (organisationsprivat) gibt es nur für `sro`; ohne Zeile gilt der Standard.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Interne Mitglieder einer Seite sieht die andere Seite nie (PLT-04).
- [x] Jede Seite kann nur ihr eigenes Team ändern. Versuche an der anderen Seite geben 403.
- [x] Bis zu zwei Sponsoren je Seite, genau ein SRO auf Käuferseite.
- [x] Die Migration überführt alle Teams aus PLT-05 ohne Verlust.
- [x] Teamänderungen stehen im Verlauf, mit der Sichtbarkeit des Mitglieds.
- [x] Die Rollenbeschreibung ist je Kunde änderbar und erscheint auf der Team-Seite.

## Nicht Teil dieser Funktion

- Kontaktpunkte (PLB-06)
- Einladung (LIF-01)
