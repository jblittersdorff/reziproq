# JBP-07 Scorecard und Unterschrift

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: GP-01. Themen, Initiativen, Freigabe und Scorecard stehen auf der Seite des Gemeinsamen Plans; die nächste Version entwirft Reziproq aus dem Protokoll; der Verlauf einer Kennzahl öffnet als Blatt (E-K4-4). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- Status und Version ändert für beide Seiten `app_scorecard_transition` (Rolle `reziproq_scorecard`,
  Migration 0049): `signed` nur mit Unterschriften beider Seiten unter dieselbe Version.
- Jede Seite schlägt nur eigene Kennzahlen vor; Verantwortlich ist eine Person der eigenen Seite.
  Ändert sich eine Kennzahl nach einer Unterschrift, beginnt eine neue Version und die Unterschrift
  gilt nicht mehr.
- Werte stehen als Dezimalzahl (`numeric`), nie als Gleitkomma.
- **Mail an die andere Seite:** Unterschreibt der Käufer, bekommen die Personen des Lieferanten mit
  angenommener Einladung eine Mail. Unterschreibt der Lieferant zuerst, sieht der SRO die Aufgabe
  „Scorecard unterschreiben“ auf Start; die Lieferantenseite kennt keine Adressen des Käufers.
- Die Erinnerung (ZYK-02) geht beim Schritt Scorecard nur an die Seite, die noch fehlt.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Eine elfte Kennzahl wird abgelehnt.
- [x] Die Scorecard gilt erst mit beiden Unterschriften, danach ist die Version gesperrt.
- [x] Jede Kennzahl hat Ziel, Termin, Verantwortliche und „Nutzen für“.
- [x] Vor Fristende geht eine Erinnerung an die Seite, die noch nicht unterschrieben hat.
- [x] Beide Unterschriften erledigen den Zyklus-Schritt Scorecard.

## Nicht Teil dieser Funktion

- Ist-Werte (JBP-09)
