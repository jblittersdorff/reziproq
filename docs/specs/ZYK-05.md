# ZYK-05 Neuer Zyklus

Release 1.0 · baut auf ZYK-01, SPL-07, JBP-06

## Ziel

Nach einem Jahr startet der SRO den nächsten Zyklus. Er baut auf dem freigegebenen Lieferantenplan und den laufenden Initiativen auf, statt bei null zu beginnen. Der alte Zyklus bleibt lesbar.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Neuen Zyklus starten. |
| Käufer: alle mit Zugriff | Alte Zyklen lesen. |

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

- [ ] Der Start eines neuen Zyklus verändert keine Daten des alten.
- [ ] Der neue Lieferantenplan entspricht inhaltlich dem letzten freigegebenen und ist ein Entwurf.
- [ ] Laufende Initiativen und offene Maßnahmen bleiben unverändert und erscheinen im neuen Zyklus.
- [ ] Das Archiv zeigt jeden alten Zyklus vollständig und nur lesend.

## Nicht Teil dieser Funktion

- Automatischer Start ohne SRO
