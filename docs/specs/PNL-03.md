# PNL-03 Baseline und Reifegrade

Release 0.3 · baut auf PNL-01 · deckt ab PNL-03, PNL-04

## Ziel

Jede Wirkung hat eine eingefrorene Ausgangsbasis und steigt nur mit Nachweis von der Idee bis zur realisierten Wirkung. So hält die Zahl jeder Prüfung durch das Controlling stand.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Team des Käufers | Baseline erfassen und einfrieren, Reifegrad mit Nachweis erhöhen. |
| Controlling | Alles sehen. R5 vergibt nur die Freigabe (PNL-06). |
| Lieferant | Reifegrad und geteilte Nachweise sehen, keine Baseline. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `initiative_baseline` | `initiative_id`, `version`, `lever_template_version`, `inputs` (JSON nach Vorlage, z. B. Preis alt und Menge), `frozen_at`, `frozen_by`, `change_reason` | `buyer_private` |
| `maturity_step` | `initiative_id`, `from_level`, `to_level`, `evidence`, `evidence_link`, `decided_by`, `decided_at`, `visibility` | `shared` |

**Reifegrade und ihr Nachweis:**

| Stufe | Bedeutung | Nachweis |
|---|---|---|
| R1 | Idee | keiner |
| R2 | bewertet | Baseline eingefroren |
| R3 | beschlossen | Gemeinsamer Plan freigegeben (JBP-06) oder Beschluss in einem Termin |
| R4 | umgesetzt | Umsetzungsdatum und kurzer Nachweis |
| R5 | realisiert | Ist-Werte für mindestens einen Monat und Freigabe durch Controlling (PNL-06) |

- Eine Baseline-Änderung nach dem Einfrieren erzeugt eine neue Version und verlangt eine Begründung.

## Ablauf

1. **Wirkungs-Seite der Initiative** (`/…/wirkung/<initiative>`):
   - Reifegrad als Stufenleiste R1 bis R5
   - Abschnitt Baseline mit Kennzeichen „Intern“
   - Verlauf der Stufen
2. **Baseline erfassen** auf eigener Seite:
   - Felder nach der Vorlage des Hebels
   - **Einfrieren** mit Bestätigung auf der Seite
3. **Reifegrad erhöhen** auf eigener Seite: Die Seite nennt den nötigen Nachweis und lässt nur mit Nachweis speichern.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Keine Stufe steigt ohne ihren Nachweis. R5 nur über PNL-06.
- [ ] Eine eingefrorene Baseline ist unveränderbar, Änderungen erzeugen eine Version mit Begründung.
- [ ] Der Lieferant sieht keine Baseline (PLT-04).
- [ ] Der Verlauf zeigt jede Stufe mit Person, Datum und Nachweis.

## Nicht Teil dieser Funktion

- Monatswerte (PNL-05)
- Freigabe durch Controlling (PNL-06)
