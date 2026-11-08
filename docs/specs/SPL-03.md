# SPL-03 Beiträge der Funktionen

Release 0.2 · baut auf SPL-01, QS-01, NAV-05

## Ziel

Als SRO bitte ich die Verantwortlichen der Business Units und Warengruppen, ihre Ziele für den Lieferanten selbst einzutragen. Ich sehe, wer beigetragen hat und wer noch fehlt.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Beiträge anfordern, Fristen setzen, erinnern. |
| Angefragte Person | Ziele für ihren Bezug eintragen, Beitrag abschließen. |
| Lieferant | Nie. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `plan_contribution` | `id`, `plan_id`, `business_unit_id` oder `material_group_id`, `assignee_user_id`, `due_date`, `status` (`open`, `done`), `done_at` | `buyer_private` |

- Ziele aus einem Beitrag sind normale `plan_objective` mit dem Bezug des Beitrags.

## Ablauf

1. Auf der Plan-Seite öffnet **Beiträge anfordern** den Ablauf `/…/lieferantenplan/beitraege/neu`:
   - je BU und Warengruppe des Lieferanten eine Zeile mit vorgeschlagener Person (aus Team und Standardfunktion) und Frist
   - Knopf **Anfragen**
2. Die angefragten Personen bekommen eine Mail (QS-01). Die Anfrage erscheint unter „Fällig bei mir“.
3. **Beitrag** (`/…/lieferantenplan/beitrag/<id>`): Die Person sieht Soll-Typ und Zusammenfassung, trägt Ziele je Kategorie ein und klickt auf **Beitrag abschließen**.
4. Die Plan-Seite zeigt den Fortschritt als „x von y Beiträgen“. Offene Beiträge sind mit Person und Frist aufgelistet.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Eine Anfrage für alle BUs und Warengruppen eines Lieferanten lässt sich in einem Schritt stellen (`apps/api/src/modules/supplier-plans/plan-contributions.test.ts`, `apps/web/e2e/spl-03.spec.ts`).
- [x] Jede angefragte Person bekommt genau eine Mail und sieht die Anfrage auf Start (`apps/api/src/modules/supplier-plans/plan-contributions.test.ts`).
- [x] Ziele aus einem Beitrag erscheinen sofort im Plan mit dem richtigen Bezug (`apps/api/src/modules/supplier-plans/plan-contributions.test.ts`).
- [x] Der Fortschritt stimmt mit den Beiträgen überein (`apps/api/src/modules/supplier-plans/plan-contributions.test.ts`, `apps/web/e2e/spl-03.spec.ts`).
- [x] Eine angefragte Person kann nur Ziele ihres Bezugs anlegen; Bezug und Verantwortliche kommen aus dem Beitrag (`apps/api/src/modules/supplier-plans/plan-contributions.test.ts`).

## Nicht Teil dieser Funktion

- Freigabe (SPL-07)
- Erinnerungen vor der Frist (über ZYK-02 für den Plan insgesamt)
