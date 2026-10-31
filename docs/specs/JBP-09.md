# JBP-09 Ist-Werte der Kennzahlen

Release 0.3 · baut auf JBP-07

## Ziel

Beide Seiten tragen die Ist-Werte der Scorecard ein oder importieren sie. Je Kennzahl ist auf einen Blick sichtbar, ob sie auf Kurs ist.

## Wer darf was

| Rolle | Darf |
|---|---|
| Verantwortliche Seite einer Kennzahl | Ist-Werte erfassen und importieren. |
| Beide Seiten | Werte und Verlauf sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `kpi_value` | `kpi_id`, `period` (Monat), `value`, `entered_by`, `source` (`manual`, `csv`), `entered_at` | `shared`, mit Verlauf |

**Auf Kurs?**

| Stand | Bedeutung |
|---|---|
| auf Kurs | Der letzte Wert liegt mindestens auf der Linie von der Basis zum Ziel. |
| knapp | Der Wert liegt bis zu 10 % dahinter. |
| nicht auf Kurs | Der Wert liegt mehr als 10 % dahinter. |

Die 10 % sind je Kunde einstellbar. Die Richtung (`higher` oder `lower`) entscheidet, was „dahinter“ heißt.

## Ablauf

1. In der Scorecard bekommt jede Kennzahl eine kleine Linie mit Ist-Werten, Ziellinie und Stand „auf Kurs“. Die Bedeutung hängt nicht nur an der Farbe.
2. Ein Klick öffnet die Kennzahl-Seite mit Verlauf, Werte-Tabelle und **Wert erfassen** auf eigener Seite.
3. **CSV-Import** (`/…/scorecard/import`): Spalten Kennzahl, Monat, Wert, mit Vorschau und Fehlermarkierung wie in PLT-07.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Zwölf Monatswerte lassen sich in einem Schritt importieren, fehlerhafte Zeilen sind markiert.
- [ ] Der Stand stimmt für beide Richtungen und die Grenzfälle.
- [ ] Nur die verantwortliche Seite erfasst Werte.
- [ ] Der Verlauf je Kennzahl ist für beide Seiten sichtbar.
- [ ] Die Scorecard erscheint mit Ist-Werten live im Termin (QBR-01).

## Nicht Teil dieser Funktion

- Werte aus anderen Systemen (nach 1.0)
- GuV-Wirkung (PNL)
