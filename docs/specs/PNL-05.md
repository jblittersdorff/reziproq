# PNL-05 Monatswerte Plan und Ist

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: WK-01. Die Rechengrundlage (Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad, Monatswerte) gilt weiter und wird die Wert-Engine; Seiten nach WK-01 (Wert, Wertkonto, Mappe „Wirkung freigeben“). Beträge in Cent (E-K0-10), Wertart „strategisch“ ohne Euro (E-K0-11), Bestätigung durch das Controlling per Link oder mit Konto (E-K0-12). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- `initiative_value` heißt im Betrag `value_cents` statt `amount_cents`: Die Prüfung privater
  Spalten (PLT-08) kennt `amount_cents` als käuferprivat. Die Zeilen sind `shared`, stehen aber
  bis PNL-07 (Teilungsregel) auf Sichtbarkeit `internal`; der Lieferant sieht also noch nichts.
- Nur die Funktion `app_initiative_recompute` (SECURITY DEFINER, Rolle `reziproq_wirkung_rechnung`)
  schreibt `initiative_value`; die App-Rolle darf weder einfügen noch ändern noch löschen. Die
  Rechnung nimmt je Monat und Art die jüngste Eingabe, die jüngste Wirkung und die jüngste
  Baseline über `app_lever_amount` und lässt freigegebene Zeiträume unberührt.
- Die API fügt Eingaben nur an (der Verlauf bleibt); eine neue Eingabe für denselben Monat ersetzt die alte in der
  Anzeige. Geldfelder im Import in Euro, gespeichert in Cent.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Zwölf Monatswerte lassen sich in einem Schritt importieren.
- [x] Jeder Betrag entspricht der Rechenregel mit Baseline und Eingaben (Test je Hebel).
- [x] `initiative_value` lässt sich nicht direkt schreiben, nur durch die Rechnung.
- [x] Der Lieferant sieht weder Mengen noch Preise (PLT-04).
- [x] Gesperrte Monate lassen sich nicht ändern.

## Nicht Teil dieser Funktion

- Freigabe (PNL-06)
- Werte aus SAP (nach 1.0)
