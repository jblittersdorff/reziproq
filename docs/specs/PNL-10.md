# PNL-10 P&L-Brücke und Wirkung im Portfolio

Release 0.3 · baut auf PNL-07, SEG-07

## Ziel

Als SRO sehe ich je Beziehung, wie die Initiativen zur GuV-Wirkung beitragen. Als CPO sehe ich die Wirkung aller Fokuslieferanten auf einer Seite: nach Reifegrad, Business Unit und Geschäftsjahr.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Brücke und Portfolio sehen, nur für Lieferanten, die sie sehen dürfen. |
| Lieferant | Die Brücke seiner Beziehung mit geteilten Werten sehen. |

## Daten

- Keine neuen Tabellen. Alles wird aus `initiative_value`, Reifegrad, Teilung und Savings-Referenz berechnet.
- **Geschäftsjahr:** Beginn je Kunde einstellbar, Standard Januar.
- **Zwei Sichten:**

| Sicht | Bedeutung |
|---|---|
| Jahreswirkung | Wirkung über zwölf Monate ab Wirkungsbeginn |
| Wirkung im Geschäftsjahr | nur die Monate des gewählten Geschäftsjahrs |

## Ablauf

1. **Lieferant › Wirkung** zeigt oben die **P&L-Brücke** als Wasserfall nach `visualisierung.md`:
   - je Initiative ein Balken mit EBIT-Wirkung
   - Farbe und Beschriftung nach Reifegrad
   - am Ende die Summe
   - Andere Wirkungsarten stehen daneben als eigene Kacheln, nie im Wasserfall.
2. **Wirkung** (`/wirkung`) zeigt Kacheln:
   - **Pipeline:** EBIT-Wirkung nach Reifegrad R1 bis R5, getrennt nach Wirkungsart
   - **Portfolio:** Wirkung je BU und Geschäftsjahr als Tabelle mit Balken
   - **Freigaben:** offene Anfragen (PNL-06)
   - **Top-Beziehungen** nach realisierter EBIT-Wirkung
3. Umschalter Jahreswirkung bzw. Geschäftsjahr und Auswahl des Geschäftsjahrs, beides in der Adresse.
4. Jeder Balken und jede Zeile führt zur Beziehung bzw. Initiative.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Der CPO sieht die Wirkung aller Fokuslieferanten auf einer Seite.
- [ ] Brücke und Summen stimmen mit `initiative_value` überein, ohne Initiativen mit Savings-Referenz.
- [ ] Keine Summe über Wirkungsarten, auch nicht in Diagrammen.
- [ ] Jahreswirkung und Wirkung im Geschäftsjahr stimmen mit Testdaten für ein Geschäftsjahr ab April.
- [ ] Der Lieferant sieht in seiner Brücke nur geteilte Werte.

## Nicht Teil dieser Funktion

- Excel-Export (PNL-11)
- Benchmark über Kunden (nach 1.0)
