# ZYK-04 Stand der Zyklen

Release 0.2 · baut auf ZYK-02, SEG-07

## Ziel

Als Leitung des Lieferantenmanagements sehe ich auf einer Seite, bei welchen Fokuslieferanten der Zyklus stockt und wer gerade dran ist.

## Wer darf was

| Rolle               | Darf                                                        |
| ------------------- | ----------------------------------------------------------- |
| Käufer: alle Rollen | Die Seite sehen, nur mit Lieferanten, die sie sehen dürfen. |
| Lieferant           | Nie.                                                        |

## Daten

- Keine neuen Tabellen. Schritte, Status und Fälligkeiten kommen aus ZYK-01 und ZYK-02.

## Ablauf

1. **Portfolio › Stand der Zyklen** (`/portfolio/zyklen`) ist eine Tabelle je Fokuslieferant mit diesen Spalten:
   - Lieferant
   - SRO
   - aktueller Schritt
   - Fälligkeit
   - Tage im Verzug
   - Termin des Joint Business Planning
2. Standardmäßig ist die Tabelle nach Verzug sortiert, umschaltbar nach Termin.
3. Filter nach SRO, BU und Warengruppe, in der Adresse.
4. Oben stehen drei Kennzahlen: Zyklen gesamt, im Plan, im Verzug.
5. Ein Klick auf eine Zeile öffnet den Überblick des Lieferanten.
6. Die Kachel auf der Portfolio-Seite zeigt die Zahl der Zyklen im Verzug.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Schritt, Fälligkeit und Verzug stimmen mit ZYK-01 und ZYK-02 überein und sind nirgends gespeichert (`apps/api/src/modules/overview/zyk-04.test.ts`).
- [x] Sortierung und Filter wirken und stehen in der Adresse (`apps/api/src/modules/overview/zyk-04.test.ts`, `apps/web/src/features/portfolio/zyk-04.test.tsx`).
- [x] Fokuslieferanten ohne Termin stehen oben mit „Termin fehlt“ (`apps/api/src/modules/overview/zyk-04.test.ts`, `apps/web/src/features/portfolio/zyk-04.test.tsx`).
- [x] Die Seite lädt bei 50 Fokuslieferanten in unter zwei Sekunden (lokal gemessen) (`apps/api/src/modules/overview/zyk-04.test.ts`).

## Umsetzung (16.11.2026)

- API `GET /portfolio/zyklen` mit `?sro=&bu=&wg=&sortierung=termin`; Recht `portfolio.sehen`.
  Je Fokuslieferant rechnet `readActiveCycle` den Stand wie der Überblick; aktueller Schritt ist
  der erste offene. „Tage im Verzug“ zählt ab der ältesten verpassten Frist.
- Fokuslieferanten ohne aktiven Zyklus stehen mit „Kein Zyklus gestartet“ in der Tabelle, zählen
  aber nicht zu „Zyklen gesamt“. Wie Lieferanten ohne JBP-Termin stehen sie oben.

## Nicht Teil dieser Funktion

- Neuer Zyklus (ZYK-05)
- Hinweise bei Verzug (FS-01)
