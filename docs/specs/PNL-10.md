# PNL-10 P&L-Brücke und Wirkung im Portfolio

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: WK-01. Die Rechengrundlage (Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad, Monatswerte) gilt weiter und wird die Wert-Engine; Seiten nach WK-01 (Wert, Wertkonto, Mappe „Wirkung freigeben“). Beträge in Cent (E-K0-10), Wertart „strategisch“ ohne Euro (E-K0-11), Bestätigung durch das Controlling per Link oder mit Konto (E-K0-12). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- **Wirkung einer Initiative:** je Monat das Ist, wo es eines gibt, sonst der Plan
  (`amountInRange` in `packages/shared`). Initiativen mit Savings-Verweis zählen nirgends.
- **Jahreswirkung:** zwölf Monate ab dem eingestellten Wirkungsbeginn, sonst ab Start der
  Initiative. **Geschäftsjahr:** Beginn je Kunde in `org_setting`
  (`fiscal_year_start_month`, Standard Januar), unter Einstellungen › Geschäftsjahr.
- **Realisiert** (Top-Beziehungen) ist nur Ist in Zeiträumen, die Controlling freigegeben hat
  (PNL-06).
- **Brücke:** eigene Unterseite `Wirkung › P&L-Brücke` (`/lieferanten/<id>/wirkung/bruecke`), nur
  EBIT, je Initiative ein Balken in der Farbe ihres Reifegrads (Skala hell → dunkel, Stufe in der
  Beschriftung), am Ende die Summe. Andere Wirkungsarten stehen als eigene Kacheln daneben. Die
  Werte stehen als Tabelle darunter, jede Zeile führt zur Initiative. Schmal liegt der Wasserfall
  waagerecht.
- **Lieferant:** dieselbe Brücke oben auf `/kunden/<beziehung>/wirkung`, nur mit geteilten Werten
  (RLS); das Geschäftsjahr des Kunden ist für ihn privat, er rechnet ab Januar.
- **Portfolio** (`/wirkung`): alle aktiven Fokuslieferanten. Pipeline je Wirkungsart nach R1 bis R5;
  EBIT je Business Unit über drei Geschäftsjahre (in der Jahreswirkung im Geschäftsjahr des
  Wirkungsbeginns; Lieferanten mit mehreren BUs zählen in jeder); Top 5 nach realisierter
  EBIT-Wirkung; Weg zu den Freigaben.
- Sicht (`?sicht=jahreswirkung|geschaeftsjahr`) und Geschäftsjahr (`&gj=2026`) stehen in der Adresse.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Der CPO sieht die Wirkung aller Fokuslieferanten auf einer Seite.
- [x] Brücke und Summen stimmen mit `initiative_value` überein, ohne Initiativen mit Savings-Referenz.
- [x] Keine Summe über Wirkungsarten, auch nicht in Diagrammen.
- [x] Jahreswirkung und Wirkung im Geschäftsjahr stimmen mit Testdaten für ein Geschäftsjahr ab April.
- [x] Der Lieferant sieht in seiner Brücke nur geteilte Werte.

## Nicht Teil dieser Funktion

- Excel-Export (PNL-11)
- Benchmark über Kunden (nach 1.0)
