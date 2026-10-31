# SPL-05 Profil und Finanzen

Release 0.2 · baut auf PLT-03, SPL-04

## Ziel

Als SRO kenne ich den Lieferanten als Unternehmen: wer ihn führt, wie er finanziell dasteht und wie wichtig wir für ihn sind. Daraus leite ich ab, welchen Hebel wir haben.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin, Nutzer | Profil und Kennzahlen erfassen und importieren. |
| Käufer: alle | Sehen. |
| Lieferant | Nie. Die Einschätzung ist intern. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `supplier_profile` | `relationship_id`, `headquarters`, `founded_year`, `employees`, `business_segments` (Text), `implications` (Text „Was heißt das für uns?“), `updated_at` | `buyer_private` |
| `supplier_executive` | `relationship_id`, `name`, `role`, `since` | `buyer_private` |
| `supplier_financial` | `relationship_id`, `year`, `metric` (`revenue`, `ebit_margin`, `net_debt`, `equity_ratio`, `cash`), `value`, `unit` (Cent mit Währung oder Basispunkte), `source` (Text oder Link) | `buyer_private` |

- **Unser Anteil** = eigener Spend eines Jahres geteilt durch den Umsatz des Lieferanten im selben Jahr. Er wird nur berechnet, wenn die Währungen übereinstimmen, sonst erscheint ein Hinweis.
- Nur öffentlich verfügbare oder vom Lieferanten gelieferte Zahlen. Personen nur mit Name und Rolle.

## Ablauf

1. **Lieferant › Strategie › Profil und Finanzen** (`/lieferanten/<id>/strategie/profil`) erweitert die Profilseite aus PLT-03 um:
   - **Unternehmensprofil**
   - **Geschäftsleitung** als Liste
   - **Finanzkennzahlen** als kleine Liniendiagramme über die Jahre: Umsatz, Marge, Verschuldung, Liquidität
   - **Unser Anteil** als große Kennzahl
   - **Was heißt das für uns?** als Freitext
2. Bearbeiten auf eigenen Seiten je Abschnitt.
3. Kennzahlen lassen sich als CSV importieren (Jahr, Kennzahl, Wert, Einheit, Quelle).
4. Die Kachel Profil und Finanzen im Lieferantenplan zeigt „Unser Anteil“.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jede Kennzahl hat Jahr, Einheit und Quelle. Ohne Quelle lässt sie sich nicht speichern.
- [ ] Unser Anteil stimmt mit Testdaten und erscheint nicht bei unterschiedlichen Währungen.
- [ ] Ein CSV-Import mit zwölf Zeilen gelingt in einem Schritt. Fehlerhafte Zeilen sind markiert.
- [ ] Beträge liegen als Ganzzahl in Cent, Quoten in Basispunkten.
- [ ] Der Test-Lieferant sieht nichts davon (PLT-04).

## Nicht Teil dieser Funktion

- Automatischer Abruf von Finanzdaten (nach 1.0)
- Risiko-Bewertung
