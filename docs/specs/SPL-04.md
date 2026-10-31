# SPL-04 Spend-Entwicklung

Release 0.2 · baut auf PLT-03, PLT-06, PLT-07

## Ziel

Als SRO sehe ich, wie sich der Spend bei einem Lieferanten über die Jahre entwickelt, je Business Unit und Warengruppe, Ist und Plan.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin, Nutzer | Spend erfassen und importieren. |
| Käufer: alle | Sehen. |
| Lieferant | Nie. |

## Daten

`relationship_spend` (aus PLT-03) bekommt diese Felder:

| Feld | Bedeutung |
|---|---|
| `kind` | `actual` oder `plan` |
| `business_unit_id` | optional, für die Aufteilung nach BU |
| `material_group_id` | optional, für die Aufteilung nach Warengruppe |

- Ohne Aufteilung gilt eine Zeile für den ganzen Lieferanten.
- Die Importvorlage Spend (PLT-07) bekommt die optionalen Spalten Art, Business Unit und Warengruppe.

## Ablauf

1. **Lieferant › Strategie › Spend** (`/lieferanten/<id>/strategie/spend`), von oben nach unten:
   - **Kennzahlen:** Spend des letzten Jahres, Veränderung zum Vorjahr, Anteil am gesamten Spend des Käufers
   - **Diagramm:** Spend je Jahr als Säulen, gestapelt nach BU oder Warengruppe (Umschalter in der Adresse). Plan-Jahre hell abgesetzt.
   - **Tabelle** der Einträge darunter, Erfassen und Ändern auf eigenen Seiten
2. Die Kachel Spend im Lieferantenplan (SPL-01) zeigt den Spend des letzten Jahres und die Veränderung.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Summen je Jahr, BU und Warengruppe stimmen mit der Datenbank überein.
- [ ] Ist und Plan sind im Diagramm klar unterscheidbar, nicht nur durch Farbe.
- [ ] Der Import mit den neuen Spalten funktioniert. Alte Dateien ohne diese Spalten funktionieren weiter.
- [ ] Der Anteil am gesamten Spend stimmt mit Testdaten.
- [ ] Das Diagramm nutzt Diagramm-Tokens und ist bei 390 px lesbar.

## Nicht Teil dieser Funktion

- Spend aus SAP oder Coupa (nach 1.0)
- Mengen und Preise je Teil (PNL-05)
