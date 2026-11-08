# SPL-01 Lieferantenplan und Zielkategorien

Release 0.2 · baut auf ZYK-01, SEG-06, PLT-06 · deckt ab SPL-01, SPL-02

## Ziel

Als SRO halte ich auf einer internen Seite fest, was wir mit einem Fokuslieferanten erreichen wollen: eine kurze Strategie und Ziele je Business Unit oder Warengruppe, geordnet nach Kategorien. So spricht das Unternehmen mit einer Stimme.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Plan anlegen, Zusammenfassung und Ziele bearbeiten. |
| Team-Mitglieder | Ziele bearbeiten, für die sie verantwortlich sind. |
| Käufer: alle mit Zugriff | Plan sehen. |
| Admin | Zielkategorien in den Einstellungen pflegen. |
| Lieferant | Nie (SPL-09). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `objective_category` | `org_id`, `key`, `name`, `position`, `active` | `org_private` |
| `supplier_plan` | `id`, `relationship_id`, `cycle_id`, `version`, `status` (`draft`, `in_review`, `approved`, `superseded`), `summary`, `created_at` | `buyer_private` |
| `plan_objective` | `id`, `relationship_id`, `plan_id`, `category_key`, `business_unit_id` oder `material_group_id`, `text`, `owner_user_id`, `target_year` | `buyer_private` |

- **Sieben Standard-Kategorien**, je Kunde änderbar: Kosten, Qualität, Technologie, Versorgung, Nachhaltigkeit, Kapazität und Standort.
- **Der Plan speichert nur, was ihm gehört.** Soll-Typ, SRO, Spend, Feedback und Finanzen zeigt er als Kennzahl mit Verweis aus ihrem Ort.
- `plan_objective.relationship_id` ist für die buyer-private RLS erforderlich; ein zusammengesetzter Fremdschlüssel bindet es an die Beziehung des Plans.

## Ablauf

1. **Lieferant › Strategie › Lieferantenplan** (`/lieferanten/<id>/strategie/lieferantenplan`), von oben nach unten:
   - **Kopfzeile:** Version, Status, Soll-Typ (aus SEG-06), SRO
   - **Zusammenfassung:** wenige Sätze, bearbeitbar auf eigener Seite
   - **Ziele** nach Kategorie, je Ziel BU oder Warengruppe, Verantwortliche und Zieljahr
   - **Verweis-Kacheln** mit je einer Kennzahl:
     - Feedback (PUL-03)
     - Spend (SPL-04)
     - Profil und Finanzen (SPL-05)
     - Strategische Themen (SPL-06)
     - Freigabe (SPL-07)
2. Ohne Plan: Knopf **Lieferantenplan anlegen**. Er legt einen Entwurf für den aktiven Zyklus an.
3. **Ziel hinzufügen und ändern** auf eigenen Seiten. Kategorie, Bezug und Text sind Pflicht.
4. **Einstellungen › Zielkategorien** (`/einstellungen/zielkategorien`): Liste, Neu und Bearbeiten auf eigenen Seiten, Deaktivieren statt Löschen.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Ein Plan gehört zu genau einem Zyklus. Je Zyklus gibt es höchstens einen Entwurf.
- [x] Jedes Ziel hat Kategorie, Bezug, Verantwortliche und Zieljahr.
- [x] Der Plan speichert weder Spend noch Finanzen noch Soll-Typ. Ein Test prüft die Spalten.
- [x] Ändert sich der Soll-Typ in SEG-06, zeigt der Plan den neuen ohne Bearbeitung.
- [x] Beim ersten Aufruf des Plans oder der Kategorien erhalten Käuferorganisationen idempotent alle sieben Standard-Kategorien.
- [x] Der Test-Lieferant bekommt 403 auf Plan- und Kategorien-Endpunkten (PLT-04).

## Nicht Teil dieser Funktion

- Beiträge der Funktionen (SPL-03)
- Strategische Themen (SPL-06)
- Freigabe und Versionen (SPL-07)
