# PNL-05 Monatswerte Plan und Ist

Release 0.3 · baut auf PNL-03

## Ziel

Als SRO erfasse ich je Monat Plan- und Ist-Werte wie Preise, Mengen oder Fehlerteile. Daraus rechnet Reziproq die Wirkung je Monat aus.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Team des Käufers | Monatswerte erfassen und importieren. |
| Controlling | Sehen. |
| Lieferant | Sieht nur die berechnete, geteilte Wirkung (PNL-07), keine Mengen oder Preise. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `initiative_input_month` | `initiative_id`, `month`, `kind` (`plan`, `actual`), `inputs` (JSON nach Vorlage), `entered_by`, `source` | `buyer_private` |
| `initiative_value` | `initiative_id`, `month`, `kind`, `amount_cents`, `currency`, `effect_type`, `computed_at` | `shared` |

- `initiative_value` entsteht nur durch die Rechnung in SQL aus Baseline und Monatswerten, nie von Hand.
- Nach der Freigabe durch Controlling (PNL-06) sind die Werte des Monats gesperrt.

## Ablauf

1. Auf der Wirkungs-Seite der Initiative steht die Tabelle **Monatswerte**: Monate als Zeilen, Plan und Ist mit den Eingaben der Vorlage und dem berechneten Betrag.
2. **Monat erfassen** auf eigener Seite, mit den Feldern der Vorlage.
3. **CSV-Import** (`/…/wirkung/<initiative>/import`) mit den Spalten Monat, Art und den Eingaben der Vorlage. Vorschau und Fehlermarkierung wie in PLT-07.
4. Darüber ein kleines Diagramm: Plan und Ist je Monat sowie die Summe im Jahr.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Zwölf Monatswerte lassen sich in einem Schritt importieren.
- [ ] Jeder Betrag entspricht der Rechenregel mit Baseline und Eingaben (Test je Hebel).
- [ ] `initiative_value` lässt sich nicht direkt schreiben, nur durch die Rechnung.
- [ ] Der Lieferant sieht weder Mengen noch Preise (PLT-04).
- [ ] Gesperrte Monate lassen sich nicht ändern.

## Nicht Teil dieser Funktion

- Freigabe (PNL-06)
- Werte aus SAP (nach 1.0)
