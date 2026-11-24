# SPL-07 Freigabe und Versionen des Lieferantenplans

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: AK-01. Der Lieferantenplan steht in der Akte unter Nur für dich; eine neue Version entsteht als Entwurf (UX-20, Ablauf 4). Inhalt und Freigabe gelten weiter. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.2 · baut auf SPL-01, SPL-03, SPL-06, PLT-05 · deckt ab SPL-07, SPL-09

## Ziel

Als SRO gebe ich den Lieferantenplan gemeinsam mit dem Sponsor frei. Danach ist er die verbindliche interne Linie gegenüber dem Lieferanten und bleibt in seiner Version unverändert.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO | Plan zur Freigabe schicken und freigeben. |
| Sponsor der Beziehung | Freigeben oder mit Begründung zurückgeben. |
| Käufer: alle mit Zugriff | Versionen sehen und vergleichen. |
| Lieferant | Nie. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `plan_approval` | `plan_id`, `user_id`, `role` (`sro`, `sponsor`), `decision` (`approved`, `returned`), `comment`, `decided_at` | `buyer_private` |

- **Status:** `draft` → `in_review` → `approved`.
- **Freigegeben** ist der Plan, wenn SRO und ein Sponsor zugestimmt haben. Gibt es keinen Sponsor, genügt der SRO, mit Hinweis.
- **Neue Version:** Wer einen freigegebenen Plan ändert, erzeugt eine Kopie als neue Version im Entwurf. Die alte wird `superseded`.

## Ablauf

1. Auf der Plan-Seite: **Zur Freigabe**. Davor zeigt die Seite offene Beiträge und fehlende Themen als Hinweis.
2. Die Freigebenden bekommen eine Mail (QS-01) und sehen die Anfrage unter „Fällig bei mir“.
3. **Freigabe-Seite** (`/…/lieferantenplan/freigabe`):
   - Plan in Leseansicht
   - Knöpfe **Freigeben** und **Zurückgeben**, Zurückgeben mit Pflichtbegründung
4. Nach der Freigabe:
   - Der Plan ist gesperrt.
   - Der Zyklus-Schritt Lieferantenplan ist erledigt (ZYK-01).
   - Die Kopfzeile zeigt „Freigegeben am …“.
5. **Versionen** (`/…/lieferantenplan/versionen`): Liste aller Versionen. Zwei lassen sich vergleichen, Änderungen je Abschnitt sind hervorgehoben.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Freigegeben erst mit SRO und Sponsor bzw. nur SRO, wenn kein Sponsor im Team ist.
- [x] Eine freigegebene Version lässt sich nicht ändern. Bearbeiten erzeugt eine neue Version.
- [x] Zurückgeben setzt den Status auf Entwurf und verlangt eine Begründung.
- [x] Der Vergleich zeigt geänderte Ziele, Themen und Zusammenfassung.
- [x] Die Freigabe erledigt den Zyklus-Schritt Lieferantenplan.
- [x] Ein Test geht alle Tabellen des Lieferantenplans durch: Der Test-Lieferant sieht keine Zeile (SPL-09).

## Umgesetzt mit (PR zu SPL-07)

- **Runden:** Jede Einreichung zählt `review_round` hoch. Freigegeben ist der Plan, wenn in der laufenden Runde der SRO und, falls es einen gibt, ein Sponsor zugestimmt haben. Jede Person entscheidet einmal je Runde.
- **Einreichen:** Das darf der SRO der Beziehung. Je freigebende Person entsteht ein interner Verlaufseintrag `plan_approval_request` mit Mail (Vorlage `approval`).
- **Aufgabe:** „Lieferantenplan freigeben“ steht unter „Fällig bei mir“, mit Frist eine Woche nach dem Einreichen.
- **Sperre auch in der Datenbank:** `app_plan_content_locked` (Ziele, Themen) und `app_plan_summary_locked` (Zusammenfassung, kein Weg zurück aus freigegeben oder abgelöst).
- **Neue Version:** Sie kopiert Zusammenfassung, Ziele und Themen samt Verknüpfungen. Beiträge bleiben bei der alten Version. Die alte wird `superseded`.
- **Zyklus:** Der Schritt Lieferantenplan gilt als erledigt, sobald im Zyklus eine Version freigegeben oder abgelöst ist. Er führt zum Plan.
- **Vergleich in der Oberfläche:**
  - Ziele gelten über Kategorie, Bezug, Text und Jahr als gleich.
  - Themen gelten über den Titel als gleich; geänderte Begründung oder Priorität zählt als geändert.

## Nicht Teil dieser Funktion

- PDF für interne Gremien (QS-03)
- KI-Entwurf der Zusammenfassung (SPL-10)
