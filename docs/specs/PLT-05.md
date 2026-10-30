# PLT-05 Rollen und Rechte

Release 0.1 · Reihenfolge 8 · baut auf PLT-02 und PLT-03 · zieht die Rechte für alles bisher Gebaute nach

## Ziel

Jeder Nutzer darf genau das, was seine Rolle erlaubt. Die Regeln stehen an einer Stelle im Backend und sind für jede Rolle durch Tests belegt.

## Wer darf was

**Rolle in der Organisation** (genau eine je Nutzer):

| Rolle | Darf |
|---|---|
| Admin | Alles in der eigenen Organisation, dazu Mitglieder und Rollen verwalten, BUs und Warengruppen pflegen (PLT-06), SRO festlegen. |
| Nutzer | Lesen und fachlich arbeiten: Lieferanten anlegen und ändern, importieren, später bewerten. Keine Verwaltung. |
| Leser | Nur lesen. |

**Zusatzrolle Controlling** (kombinierbar mit Nutzer oder Leser): darf später GuV-Wirkungen freigeben (PNL-06). In 0.1 nur als Feld und in der Rechte-Matrix angelegt.

**Rolle je Beziehung** (über `relationship_member`):

| Teamrolle | Bedeutung |
|---|---|
| SRO | Verantwortet die Beziehung, darf später die Unternehmenssicht der Segmentierung festlegen (SEG-05). |
| Sponsor | Executive Sponsor, auch zwei je Beziehung (z. B. Einkauf und Entwicklung). |
| Mitglied | Arbeitet in der Beziehung mit. |
| Leser | Darf die Beziehung lesen, auch wenn seine Organisationsrolle mehr erlaubt. |

**Funktion** je Mitgliedschaft: Einkauf, Qualität, Entwicklung, Logistik. Sie steuert später, welche Bewertung jemand abgibt und sieht (SEG-02).

## Daten

| Tabelle | Felder | Ebene |
|---|---|---|
| `app_user` (erweitern) | `org_role` (`admin`, `member`, `viewer`), `is_controlling` (ja/nein), `default_function` (optional) | Teil der Organisation |
| `relationship_member` (neu) | `relationship_id`, `org_id`, `user_id`, `team_role` (`sro`, `sponsor`, `member`, `viewer`), `function`, `created_at` | `org_private` mit `org_id` der Seite. Jede Seite sieht ihr eigenes Team. Das gemeinsame Team kommt mit PLB-03. |

- Neue Nutzer starten als `viewer`. Den ersten Admin je Organisation setzt das Seed-Skript bzw. `pnpm org:link --admin <email>`.
- Rollen liegen in der Datenbank, nicht in Zitadel. Zitadel liefert nur die Identität.
- **`can(user, action, resource)`** ist die einzige Stelle für Rechte. Jeder Endpunkt ruft sie auf, bevor er Daten anfasst. Die Regeln stehen als Matrix in einer Datei `permissions.ts`. Aus ihr erzeugt ein Skript eine lesbare Tabelle in `docs/rechte.md`.
- Die Oberfläche fragt `GET /me/permissions` ab und blendet Knöpfe aus, die der Nutzer nicht nutzen darf. Entscheidend bleibt immer das Backend.

**Rechte-Matrix für das bisher Gebaute:**

| Aktion | Admin | Nutzer | Leser | Controlling (zusätzlich) |
|---|---|---|---|---|
| Organisation und Mitglieder sehen | ja | ja | ja | – |
| Rollen ändern | ja | nein | nein | – |
| Lieferanten sehen, Spend sehen | ja | ja | ja | – |
| Lieferant anlegen, ändern, beenden | ja | ja | nein | – |
| SRO und Team je Beziehung festlegen | ja | nein | nein | – |
| Verlauf sehen | ja | ja | ja | – |
| GuV-Wirkung freigeben (ab PNL-06) | nein | nein | nein | ja |

Teamrolle Leser in einer Beziehung schränkt dort ein: Auch ein Nutzer darf diese Beziehung dann nur lesen.

## Ablauf

1. Admin öffnet **Einstellungen → Organisation**. Er sieht alle Mitglieder mit Name, E-Mail, Rolle und Controlling-Haken.
2. Er ändert die Rolle über eine Auswahl. Die Änderung gilt sofort und erscheint im Verlauf.
3. Im Detail-Panel einer Beziehung (PLT-03) gibt es den Abschnitt **Team (intern)**. Admins legen dort SRO und Mitglieder mit Teamrolle und Funktion fest. Alle anderen sehen das Team nur.
4. Nutzer ohne Recht sehen keine Knöpfe für Aktionen, die sie nicht ausführen dürfen. Ruft jemand die API trotzdem direkt auf, bekommt er 403.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein tabellengesteuerter Test prüft jede Zeile der Rechte-Matrix für jede Rolle gegen die API: erlaubt gibt 2xx, verboten gibt 403.
- [ ] Ein Test geht alle Endpunkte durch und scheitert, wenn einer ohne `can()`-Prüfung auskommt (außer `/health` und `/me`).
- [ ] Der letzte Admin einer Organisation kann sich nicht selbst herabstufen.
- [ ] Neue Nutzer sind `viewer`.
- [ ] Teamrolle Leser macht eine Beziehung für diesen Nutzer schreibgeschützt.
- [ ] Ein Nutzer des Zweit-OEM sieht das Team des Test-OEM beim gemeinsamen Lieferanten nicht (Prüfungen aus PLT-04).
- [ ] Rollenwechsel und Teamänderungen stehen im Verlauf.
- [ ] `docs/rechte.md` wird aus `permissions.ts` erzeugt. Ein Test scheitert, wenn die Datei veraltet ist.
- [ ] Die Oberfläche zeigt Leser keine Knöpfe zum Anlegen, Ändern oder Beenden.

## Nicht Teil dieser Funktion

- Gemeinsames Team beider Seiten, zwei Sponsoren, Teamansicht für Lieferanten (PLB-03)
- Freigabe durch Controlling (PNL-06)
- Rechte je BU, z. B. wer welche BU-Bewertung sieht (SEG-02)
- Nutzer einladen
- Rollen aus dem Firmen-Login der Kunden übernehmen (nach 1.0)
