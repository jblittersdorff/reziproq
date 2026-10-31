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

- [ ] Jede Maßnahme hat genau eine Quelle.
- [ ] Eine geteilte Maßnahme hat keinen Fremdschlüssel auf eine private Quelle (Prüfung aus PLT-04).
- [ ] Interne Maßnahmen sieht die andere Seite nie.
- [ ] Der SRO sieht auf `/start/massnahmen` alle offenen Maßnahmen seiner Beziehungen.
- [ ] Überfällige Maßnahmen sind markiert und erscheinen auf Start der verantwortlichen Person.
- [ ] Änderungen geteilter Maßnahmen stehen im Verlauf.

## Nicht Teil dieser Funktion

- Erinnerung und Eskalation (QBR-04)
- Maßnahme aus einer Feedback-Lücke (PUL-06)
- Maßnahme aus einem Hinweis (FS-01)
