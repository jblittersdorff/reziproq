# SPL-04 Spend-Entwicklung

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: AK-01. Stammdaten, Spend je Jahr und Finanzen stehen im Profil-Blatt. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- `relationship_spend` ist eindeutig je Beziehung, Jahr, Art, Business Unit und Warengruppe
  (`NULLS NOT DISTINCT`). Jede Zeile ist ein eigener Betrag; die Summe eines Jahres ist die Summe
  aller Zeilen dieser Art. Zeilen ohne Business Unit bzw. Warengruppe erscheinen im Diagramm als
  „Ohne Zuordnung“.
- Die Sicht `relationship_spend_total` (`security_invoker`, damit RLS gilt) liefert den Ist-Spend je
  Jahr und Währung. Liste, Detail, Kachel im Überblick und die Frage-Funktion lesen sie; nur die
  Spend-Seite liest die einzelnen Zeilen (`GET /suppliers/<id>/spend`).
- Ist bis zum nächsten Jahr, Plan bis zehn Jahre voraus. Hat ein Jahr Ist, zeigt das Diagramm das
  Ist, sonst den Plan.
- Diagramm: höchstens vier benannte Anteile in fester Reihenfolge nach Summe über alle Jahre, der
  Rest als „Weitere“. Plan-Säulen sind hell, gestrichelt umrandet und unter dem Jahr mit „Plan“
  beschriftet; darunter stehen die Summen je Jahr als Tabelle.
- Kennzahlen und Diagramm in der Währung des jüngsten Ist-Jahres; Zeilen in anderen Währungen
  nennt ein Hinweis. Der Anteil am gesamten Spend entfällt, wenn der Käufer im Jahr mehrere
  Währungen hat.
- Die Importvorlage Spend hat die optionalen Spalten Art (Ist oder Plan), Business Unit und
  Warengruppe; alte Dateien gelten als Ist für den ganzen Lieferanten.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Summen je Jahr, BU und Warengruppe stimmen mit der Datenbank überein.
- [x] Ist und Plan sind im Diagramm klar unterscheidbar, nicht nur durch Farbe.
- [x] Der Import mit den neuen Spalten funktioniert. Alte Dateien ohne diese Spalten funktionieren weiter.
- [x] Der Anteil am gesamten Spend stimmt mit Testdaten.
- [x] Das Diagramm nutzt Diagramm-Tokens und ist bei 390 px lesbar.

## Nicht Teil dieser Funktion

- Spend aus SAP oder Coupa (nach 1.0)
- Mengen und Preise je Teil (PNL-05)
