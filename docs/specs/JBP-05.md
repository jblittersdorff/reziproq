# JBP-05 Zusagen

Release 0.3 · baut auf JBP-03

## Ziel

Beide Seiten halten fest, was sie einander zusagen, z. B. einen Bedarfsausblick oder eine Kapazitätsreservierung. Sie sehen, welche Zusagen überfällig sind.

## Wer darf was

| Rolle | Darf |
|---|---|
| Team-Mitglieder beider Seiten | Zusagen anlegen und bearbeiten, Status der eigenen Zusagen ändern. |
| Leser | Sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `commitment` | `id`, `relationship_id`, `jbp_id`, `initiative_id` (optional), `side` (wer zusagt), `title`, `owner_user_id` oder `owner_name`, `due_on`, `status` (`open`, `kept`, `missed`) | `shared`, mit Verlauf |

- **Aufgaben-Quelle:** Offene Zusagen erscheinen bei der verantwortlichen Person unter „Fällig bei mir“.
- **Überfällig** ist eine Zusage, die über ihre Frist hinaus offen ist.

## Ablauf

1. **Zusagen** (`/…/plan/zusagen`): zwei Spalten, Käufer sagt zu und Lieferant sagt zu, mit Frist, Verantwortlichen, Status und optionaler Initiative.
2. Überfällige stehen oben und sind markiert.
3. Neu und Bearbeiten auf eigenen Seiten. Den Status ändert die zusagende Seite.

## Umsetzung

- Jede Seite legt nur ihre eigenen Zusagen an (`owner_org_id` ist die zusagende Seite); Status und
  Bearbeiten laufen deshalb über die normalen Ebenen-Regeln, ohne Funktion.
- Verantwortlich ist eine Person der eigenen Seite (Team der Beziehung, sonst man selbst).
- Dazu (JBP-03): Bei Initiativen wählt jede Seite ihre Person über `app_initiative_owner`
  (Migration 0047); den Namen der anderen Seite gibt es nur beim Anlegen. Offene Meilensteine
  erscheinen auf Start der verantwortlichen Personen.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Überfällige Zusagen sind markiert und stehen oben.
- [x] Nur die zusagende Seite setzt `kept` oder `missed`.
- [x] Offene Zusagen erscheinen auf Start der verantwortlichen Person.
- [x] Zusagen erscheinen live im Termin (QBR-01).

## Nicht Teil dieser Funktion

- Hinweis bei überfälligen Zusagen des Käufers (FS-01)
