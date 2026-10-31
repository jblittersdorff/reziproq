# JBP-07 Scorecard und Unterschrift

Release 0.3 · baut auf JBP-06, ZYK-02 · deckt ab JBP-07, JBP-08

## Ziel

Beide Seiten übersetzen die Initiativen in wenige messbare Kennzahlen mit Zielwert, Termin und Verantwortlichen und unterschreiben die Scorecard. So ist klar, woran Erfolg gemessen wird.

## Wer darf was

| Rolle | Darf |
|---|---|
| Team-Mitglieder beider Seiten | Kennzahlen vorschlagen und bearbeiten, bis unterschrieben ist. |
| SRO und Key Account Manager | Für ihre Seite unterschreiben. |
| Beide Seiten | Scorecard sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `scorecard` | `id`, `relationship_id`, `jbp_id`, `version`, `status` (`draft`, `signed`) | `shared` |
| `scorecard_kpi` | `id`, `scorecard_id`, `initiative_id` (optional), `name`, `unit`, `direction` (`higher`, `lower`), `baseline`, `target`, `target_date`, `owner_side`, `owner_user_id` oder `owner_name`, `benefit_for` (`buyer`, `supplier`, `both`) | `shared` |
| `scorecard_signature` | `scorecard_id`, `version`, `side`, `user_id`, `signed_at` | `shared` |

- Höchstens zehn Kennzahlen je Beziehung.
- Die Unterschrift-Frist kommt aus ZYK-02 (Schritt Scorecard).
- Nach beiden Unterschriften ist die Version gesperrt. Änderungen ergeben eine neue Version mit neuer Unterschrift.

## Ablauf

1. **Scorecard** (`/…/plan/scorecard`):
   - Tabelle der Kennzahlen mit Initiative, Basis, Ziel, Termin, Verantwortlichen und Nutzen für
   - oben Status und Unterschriften
2. Neu und Bearbeiten auf eigenen Seiten. Die elfte Kennzahl wird abgelehnt, mit Hinweis.
3. **Unterschreiben** (`/…/plan/scorecard/unterschreiben`): Zusammenfassung und Bestätigung auf der Seite. Die andere Seite bekommt eine Mail.
4. Nach beiden Unterschriften ist der Zyklus-Schritt Scorecard erledigt. Vor Fristende kommt eine Erinnerung.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Eine elfte Kennzahl wird abgelehnt.
- [ ] Die Scorecard gilt erst mit beiden Unterschriften, danach ist die Version gesperrt.
- [ ] Jede Kennzahl hat Ziel, Termin, Verantwortliche und „Nutzen für“.
- [ ] Vor Fristende geht eine Erinnerung an die Seite, die noch nicht unterschrieben hat.
- [ ] Beide Unterschriften erledigen den Zyklus-Schritt Scorecard.

## Nicht Teil dieser Funktion

- Ist-Werte (JBP-09)
