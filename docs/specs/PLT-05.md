# PLT-05 Rollen und Rechte

Release 0.1 · baut auf PLT-02, PLT-03 · zieht die Rechte für alles bisher Gebaute nach · überarbeitet am 31.10.2026: Team-Seite im Bereich Beziehung

## Ziel

Jeder Nutzer darf genau das, was seine Rolle erlaubt. Die Regeln stehen an einer Stelle im Backend und sind für jede Rolle durch Tests belegt.

## Wer darf was

**Rolle in der Organisation** (genau eine je Nutzer):

| Rolle | Darf |
|---|---|
| Admin | Alles in der eigenen Organisation, dazu Mitglieder, Rollen, BUs, Warengruppen und Kataloge verwalten und Teams festlegen. |
| Nutzer | Lesen und fachlich arbeiten: Lieferanten anlegen und ändern, importieren, bewerten. Keine Verwaltung. |
| Leser | Nur lesen. |

**Zusatzrolle Controlling**, kombinierbar mit Nutzer oder Leser: Sie gibt später GuV-Wirkungen frei (PNL-06).

**Rolle je Beziehung** in `relationship_member`:

- **SRO:** verantwortet die Beziehung und legt die Unternehmenssicht der Segmentierung fest (SEG-06).
- **Sponsor:** bis zu zwei je Beziehung.
- **Mitglied**
- **Leser:** macht die Beziehung für diesen Nutzer schreibgeschützt.

**Funktion** je Mitgliedschaft: Einkauf, Qualität, Entwicklung, Logistik, Programme, After-Sales. Die Liste ist je Kunde erweiterbar.

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `app_user` (erweitern) | `org_role` (`admin`, `member`, `viewer`), `is_controlling`, `default_function` | Teil der Organisation |
| `relationship_member` (neu) | `relationship_id`, `org_id`, `user_id`, `team_role` (`sro`, `sponsor`, `member`, `viewer`), `function`, `created_at` | `org_private`. PLB-04 macht daraus ein geteiltes Team. |

- Neue Nutzer starten als `viewer`. Den ersten Admin setzt das Seed-Skript bzw. `pnpm org:link --admin <email>`.
- **Übernahme:** Eine einmalige Migration übernimmt die bisherigen Zitadel-Rollen: `admin` bleibt `admin`, `nutzer` wird `member`, `leser` wird `viewer`, `controlling` wird `is_controlling`. Danach liest die API keine Rollen mehr aus dem Token. Die Rolle `betreiber` regelt UMB-01.
- Rollen liegen in der Datenbank, nicht in Zitadel.
- **`can(user, action, resource)`** ist die einzige Stelle für Rechte. Die Matrix steht in `permissions.ts`, daraus entsteht `docs/rechte.md`.
- Die Oberfläche fragt `GET /me/permissions` ab und blendet Knöpfe aus, die der Nutzer nicht nutzen darf. Entscheidend bleibt das Backend.

**Rechte-Matrix für das bisher Gebaute:**

| Aktion | Admin | Nutzer | Leser |
|---|---|---|---|
| Organisation und Mitglieder sehen | ja | ja | ja |
| Rollen ändern | ja | nein | nein |
| Lieferanten und Spend sehen | ja | ja | ja |
| Lieferant anlegen, ändern, beenden | ja | ja | nein |
| Team einer Beziehung festlegen | ja | nein | nein |
| Verlauf sehen | ja | ja | ja |

Jede weitere Spec ergänzt die Matrix um ihre Aktionen.

## Teilung

Zwei Pull Requests:

- **PLT-05a:** Rollen in der Datenbank, Übernahme aus Zitadel, `permissions.ts`, `docs/rechte.md`, `/me/permissions`, `/einstellungen/organisation`.
- **PLT-05b:** `relationship_member`, Team-Seite, Teamrolle Leser.

## Ablauf

1. **Einstellungen › Organisation** (`/einstellungen/organisation`):
   - Liste aller Mitglieder mit Name, E-Mail, Rolle und Controlling-Haken
   - Ein Klick öffnet `/einstellungen/organisation/<nutzer>`. Dort ändert der Admin Rolle, Controlling und Standardfunktion. Speichern führt zur Liste zurück.
2. **Lieferant › Beziehung › Team** (`/lieferanten/<id>/beziehung/team`):
   - Das interne Team mit SRO, Sponsoren und Mitgliedern samt Teamrolle und Funktion
   - Hinzufügen und Ändern auf `/…/team/bearbeiten`, nur Admin
3. Nutzer ohne Recht sehen die Knöpfe nicht. Ruft jemand die API trotzdem auf, bekommt er 403.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Ein tabellengesteuerter Test prüft jede Zeile der Matrix für jede Rolle gegen die API: erlaubt gibt 2xx, verboten gibt 403.
- [x] Ein Test geht alle Endpunkte durch und schlägt fehl, wenn einer ohne `can()` auskommt. Ausgenommen sind `/health` und `/me`.
- [x] Der letzte Admin einer Organisation kann sich nicht selbst herabstufen.
- [x] Neue Nutzer sind `viewer`.
- [x] Mit Teamrolle Leser ist eine Beziehung für diesen Nutzer schreibgeschützt.
- [x] Der Zweit-OEM sieht das Team des Test-OEM nicht (Prüfungen aus PLT-04).
- [x] Rollenwechsel und Teamänderungen stehen im internen Verlauf.
- [x] `docs/rechte.md` wird aus `permissions.ts` erzeugt. Ein Test schlägt fehl, wenn die Datei veraltet ist.

## Umgesetzt mit (PR zu PLT-05a)

Entscheidungen beim Bauen, abgestimmt vor der Umsetzung:

- **Übernahme aus Zitadel:** Die Rollen standen nur im Token, eine Migration kann sie nicht lesen. Deshalb übernimmt der nächste Login sie einmalig (`roles_imported_at`); danach liest die API keine Rollen mehr aus dem Token. Den ersten Admin setzt zusätzlich `pnpm org:link --admin <email>`.
- **Controlling** ist mit jeder Rolle kombinierbar, auch mit Admin.
- **Betreiber** erkennt die API bis UMB-01 weiter am Zitadel-Token; im Kunden gelten für ihn die Rechte eines Lesers.
- Jeder Endpunkt nennt seine Aktion mit `@Requires('…')`; der AuthGuard prüft sie über `can()`. Ausnahmen sind `/health` und `/me` (mit `/me/permissions` und `/me/anmeldung`).
- `GET /api/me/permissions` liefert `{ actions }`; Aktionen der Lieferanten und Fragen nur mit Feature `buyer`. `/me` nennt `orgRole`, `isControlling` und `isOperator`.
- Rollen ändern dürfen in der Datenbank nur Admins derselben Organisation (Policy und Rechte je Spalte); ein Trigger hält mindestens einen Admin je Organisation, die API antwortet dann 409.
- Funktionen: `purchasing`, `quality`, `engineering`, `logistics`, `programs`, `after_sales`. Eigene Funktionen je Kunde kommen später.
- Beispieldaten: je OEM ein Admin, ein Nutzer mit Controlling und ein Leser.

Kriterien aus PLT-05a: Matrix gegen die API, `can()` an jedem Endpunkt, letzter Admin, neue Nutzer `viewer`, Rollenwechsel im internen Verlauf, `docs/rechte.md`. Team, Teamrolle Leser und die Datentrennung des Teams folgen mit PLT-05b.

## Umgesetzt mit (PR zu PLT-05b)

Entscheidungen beim Bauen, abgestimmt vor der Umsetzung:

- Die Teamrolle Leser macht eine Beziehung auch für Admins schreibgeschützt (Profil, Spend, Beenden). Das Team selbst darf ein Admin weiter festlegen, damit er sich wieder freischalten kann. Umgesetzt über `can(subject, action, { teamRole })` und `notForTeamViewer` in der Matrix; das Detail eines Lieferanten meldet `permissions.edit` und `permissions.editTeam` je Beziehung.
- Grenzen: höchstens ein SRO (eindeutiger Teilindex), höchstens zwei Sponsoren (Trigger), jede Person einmal. Ein Team ohne SRO ist erlaubt; die Teamseite weist darauf hin. Die API antwortet bei Verstößen mit 409 (`too_many_sro`, `too_many_sponsors`, `duplicate_person`, `nicht_in_organisation`).
- `PUT /api/suppliers/:id/team` setzt das ganze Team auf einmal; der interne Verlauf (`relationship_member`) hält das Team vorher und nachher fest.
- Beispieldaten: fünf Teams beim Test-OEM mit Lena als SRO und Tom als Sponsor; beim fünften Lieferanten ist Nina Leserin.

## Nicht Teil dieser Funktion

- Gemeinsames Team beider Seiten mit Sichtbarkeit für den Lieferanten (PLB-04)
- Freigabe durch Controlling (PNL-06)
- Rechte je BU bei der Bewertung (SEG-04)
- Nutzer einladen
