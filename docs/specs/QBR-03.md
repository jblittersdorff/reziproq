# QBR-03 Maßnahmen

Release 0.3 · baut auf QBR-01 · deckt ab QBR-03, QBR-05

## Ziel

Beide Seiten halten Maßnahmen mit Verantwortlichen und Fristen fest und sehen jederzeit, was offen ist. Jede Maßnahme weiß, woher sie kommt.

## Wer darf was

| Rolle | Darf |
|---|---|
| Team-Mitglieder beider Seiten | Geteilte Maßnahmen anlegen, Status ändern, Maßnahmen der eigenen Seite bearbeiten. |
| Jede Seite | Interne Maßnahmen, die nur sie sieht. |
| Leser | Nur sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `action` | `id`, `relationship_id`, `owner_org_id`, `visibility`, `title`, `description`, `owner_side`, `owner_user_id` oder `owner_name`, `due_date`, `status` (`open`, `in_progress`, `done`, `cancelled`), `source_type` (`meeting`, `feedback_gap`, `initiative`, `manual`), `source_id`, `done_at` | `shared` |
| `action_private_source` | `action_id`, `org_id`, `source_type` (z. B. `hint`), `source_id` | `org_private`. Für Quellen, die privat sind. |

- Eine geteilte Maßnahme verweist nur auf geteilte Quellen. Private Quellen hängen über `action_private_source` daran.
- **Aufgaben-Quelle:** Offene Maßnahmen erscheinen bei ihrer verantwortlichen Person unter „Fällig bei mir“.
- **Kennzahl-Quelle:** Der Überblick zeigt offene und überfällige Maßnahmen.

## Ablauf

1. **Lieferant › Umsetzung › Maßnahmen** (`/…/umsetzung/massnahmen`):
   - Liste mit Titel, Seite, verantwortlicher Person, Frist, Status und Quelle
   - Filter nach Status, Seite und Person, in der Adresse
   - Überfällige sind markiert.
2. Neu und Bearbeiten auf eigenen Seiten. Status ändern direkt in der Liste über eine Auswahl.
3. Auf der Termin-Seite legt **Maßnahme aus Termin** eine Maßnahme mit Quelle Termin an.
4. **Alle offenen Maßnahmen meiner Beziehungen** (`/start/massnahmen`) zeigt die Maßnahmen aller Beziehungen, in deren Team ich bin, mit Lieferant und Verweis zum Ort.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Jede Maßnahme hat genau eine Quelle.
- [x] Eine geteilte Maßnahme hat keinen Fremdschlüssel auf eine private Quelle (Prüfung aus PLT-04).
- [x] Interne Maßnahmen sieht die andere Seite nie.
- [x] Der SRO sieht auf `/start/massnahmen` alle offenen Maßnahmen seiner Beziehungen.
- [x] Überfällige Maßnahmen sind markiert und erscheinen auf Start der verantwortlichen Person.
- [x] Änderungen geteilter Maßnahmen stehen im Verlauf.

## Umgesetzt mit (PR zu QBR-03)

- **Status über die Seiten hinweg:**
  - Eine geteilte Maßnahme gehört der Seite, die sie angelegt hat (PLT-04).
  - Ihren Status ändert die andere Seite über die Funktion `app_massnahme_status`. Sie läuft als enge Rolle `reziproq_massnahmen`, darf nur `status`, `done_at` und `updated_at` schreiben und prüft die Partei samt Kundenkontext.
- **Frist ist Pflicht:** Nur so erscheint jede offene Maßnahme unter „Fällig bei mir“.
- **Verantwortlich:**
  - auf der eigenen Seite eine Person aus dem Team der Beziehung (oder man selbst)
  - auf der anderen Seite ein Name ohne ID
- **Quellen:**
  - Die Oberfläche legt heute `manual` und `meeting` an. Die Prüfung `action_one_source` steht in der Datenbank.
  - `action_private_source` ist angelegt und wartet auf FS-01.
- **Verlauf:** Geteilte Maßnahmen schreiben `action`, interne `action_internal`.
- **Live-Abschnitt:** Offene Maßnahmen erscheinen im Termin (QBR-01b) und werden beim Abschließen eingefroren.
- **Kennzahl im Überblick:** „n offen · m überfällig“; ohne Offene keine Kennzahl.
- **Ein Klick von Start:** Der Link aus Start und `/start/massnahmen` führt zur Zeile in der Liste (`…/massnahmen#<id>`).

## Nicht Teil dieser Funktion

- Erinnerung und Eskalation (QBR-04)
- Maßnahme aus einer Feedback-Lücke (PUL-06)
- Maßnahme aus einem Hinweis (FS-01)
