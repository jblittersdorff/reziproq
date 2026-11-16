# ZYK-05 Neuer Zyklus

Release 1.0 · baut auf ZYK-01, SPL-07, JBP-06

## Ziel

Nach einem Jahr startet der SRO den nächsten Zyklus. Er baut auf dem freigegebenen Lieferantenplan und den laufenden Initiativen auf, statt bei null zu beginnen. Der alte Zyklus bleibt lesbar.

## Wer darf was

| Rolle                    | Darf                  |
| ------------------------ | --------------------- |
| SRO, Admin               | Neuen Zyklus starten. |
| Käufer: alle mit Zugriff | Alte Zyklen lesen.    |

## Daten

- `cycle` (aus ZYK-01): Der alte Zyklus wird `closed`, ein neuer entsteht.
- **Übernahme beim Start:**
  - Der neue Lieferantenplan ist ein Entwurf als Kopie des letzten freigegebenen.
  - Laufende Initiativen, offene Zusagen und offene Maßnahmen bleiben, wo sie sind. Sie werden nicht kopiert.
- Der neue Gemeinsame Plan beginnt als neue Version, mit den laufenden Initiativen.

## Ablauf

1. Elf Monate nach dem letzten Joint Business Planning zeigt der Überblick **Nächsten Zyklus starten**.
2. **Zyklus starten** (`/lieferanten/<id>/zyklus/neu`):
   - was übernommen wird und was neu beginnt
   - Termin des nächsten Joint Business Planning
   - Bestätigung auf der Seite
3. **Frühere Zyklen** (`/lieferanten/<id>/zyklus/archiv`): Liste mit Plan, Gemeinsamem Plan, Scorecard und Feedback des jeweiligen Jahres, nur lesend.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Der Start eines neuen Zyklus verändert keine Daten des alten (`apps/api/src/modules/overview/zyk-05.test.ts`).
- [x] Der neue Lieferantenplan entspricht inhaltlich dem letzten freigegebenen und ist ein Entwurf (`apps/api/src/modules/overview/zyk-05.test.ts`).
- [x] Laufende Initiativen und offene Maßnahmen bleiben unverändert und erscheinen im neuen Zyklus (`apps/api/src/modules/overview/zyk-05.test.ts`).
- [x] Das Archiv zeigt jeden alten Zyklus vollständig und nur lesend (`apps/api/src/modules/overview/zyk-05.test.ts`, `apps/web/src/features/workspace/zyk-05.test.tsx`).

## Umsetzung (16.11.2026)

- `cycle` hat `closed_at`. Beim Start wird der alte Zyklus `closed` mit Zeitpunkt; sonst bleibt
  alles an ihm unverändert (Lieferantenpläne, eingefrorene Versionen des Gemeinsamen Plans).
- Der Gemeinsame Plan läuft als neue Version desselben Plans weiter (Übergang `new_version` aus
  JBP-06), wenn er freigegeben ist; Initiativen und Zusagen hängen weiter an ihm.
  `jbp_cycle_link` ist dafür je Plan und Zyklus eindeutig statt je Plan.
- In den Zyklusschritten zählen Freigabe des Gemeinsamen Plans und Unterschrift der Scorecard nur,
  wenn sie im laufenden Zyklus geschehen sind.
- Das Archiv zeigt je Zyklus die Lieferantenpläne des Zyklus und, über den Zeitraum des Zyklus,
  die freigegebenen Versionen des Gemeinsamen Plans, Scorecards und Feedback-Wellen.
- Die API lässt den Start auch vor Ablauf der elf Monate zu; der Überblick bietet den Knopf erst
  danach an.

## Nicht Teil dieser Funktion

- Automatischer Start ohne SRO
