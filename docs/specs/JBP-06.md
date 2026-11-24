# JBP-06 Freigabe und Versionen des Gemeinsamen Plans

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: GP-01. Themen, Initiativen, Freigabe und Scorecard stehen auf der Seite des Gemeinsamen Plans; die nächste Version entwirft Reziproq aus dem Protokoll; der Verlauf einer Kennzahl öffnet als Blatt (E-K4-4). Zusagen hängen an der Beziehung, nicht an der Planversion (E-K0-16). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.3 · baut auf JBP-02, JBP-03, JBP-05

## Ziel

Der Käufer füllt vor, der Lieferant kommentiert und ergänzt, und beide geben den Plan frei. Erst dann gilt er. Jede Freigabe ist als Version nachvollziehbar.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO | Plan an den Lieferanten zur Prüfung geben, für den Käufer freigeben. |
| Key Account Manager | Für den Lieferanten freigeben oder mit Begründung zurückgeben. |
| Beide Seiten | Versionen sehen und vergleichen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `jbp_approval` | `jbp_id`, `version`, `side`, `user_id`, `decision` (`approved`, `returned`), `comment`, `decided_at` | `shared` |
| `jbp_version` | `jbp_id`, `version`, `content` (JSON-Stand von Themen, Initiativen und Zusagen), `approved_at` | `shared` |

- **Status:** `draft` → `in_review` (beim Lieferanten) → `approved` (beide zugestimmt).
- **Nach der Freigabe** sind Titel, Ziele, Nutzen, Verantwortliche und Zeiträume gesperrt. Status, Meilensteine und Zusagen-Status bleiben änderbar.
- **Neue Version:** Wer den Inhalt ändern will, startet eine neue Version. Sie braucht wieder beide Freigaben.

## Ablauf

1. **Freigabe** (`/…/plan/freigabe`):
   - Status
   - Stand beider Seiten
   - Knopf für die jeweils nächste Aktion
2. Der SRO klickt auf **An Lieferant zur Prüfung geben**. Der Lieferant bekommt eine Mail und sieht die Aufgabe auf Start.
3. Der Lieferant kommentiert einzelne Punkte (QS-02, wenn vorhanden) und klickt auf **Freigeben** oder **Zurückgeben** mit Begründung.
4. Nach beiden Freigaben:
   - Der Plan ist `approved`.
   - Der Zyklus-Schritt JBP ist erledigt (ZYK-01).
   - Die Seite zeigt „Freigegeben von beiden am …“.
5. **Versionen** (`/…/plan/versionen`): Liste und Vergleich zweier Versionen.

## Umsetzung

- Den Status ändert für beide Seiten `app_jbp_transition` (Rolle `reziproq_jbp_freigabe`,
  Migration 0048). Sie erlaubt nur die Übergänge des Ablaufs; `approved` nur, wenn für die
  laufende Version eine Freigabe des Käufers und des Lieferanten vorliegt.
- Zur Prüfung geben gilt als Freigabe des Käufers für diese Version.
- Die Mail geht an die Personen des Lieferanten, die die Einladung des Käufers angenommen haben
  (käuferprivat bekannt); die Aufgabe steht auf Start der Lieferantenseite.
- `jbp_approval` und `jbp_version` sind nur anfügbar. Eine neue Version erhöht die Versionsnummer
  des Plans; Themen, Initiativen und Zusagen bleiben am Plan, der alte Stand liegt in `jbp_version`.
- Nach der Freigabe lehnen Themen, Initiativen und Zusagen Inhaltsänderungen mit 409 ab.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Der Plan ist erst freigegeben, wenn beide Seiten zugestimmt haben.
- [x] Nach der Freigabe sind die gesperrten Felder unveränderbar, Status und Meilensteine änderbar.
- [x] Eine neue Version verlangt wieder beide Freigaben, die alte bleibt lesbar.
- [x] Zurückgeben verlangt eine Begründung und setzt den Status auf Entwurf.
- [x] Die Freigabe erledigt den Zyklus-Schritt JBP.

## Nicht Teil dieser Funktion

- Scorecard (JBP-07)
- PDF des Plans (QS-03)
