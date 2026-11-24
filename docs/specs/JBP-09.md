# JBP-09 Ist-Werte der Kennzahlen

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: GP-01. Themen, Initiativen, Freigabe und Scorecard stehen auf der Seite des Gemeinsamen Plans; die nächste Version entwirft Reziproq aus dem Protokoll; der Verlauf einer Kennzahl öffnet als Blatt (E-K4-4). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- Der Stand ist eine reine Funktion (`kpiTrack` in packages/shared), die Server und Oberfläche
  gleich nutzen. Die Linie beginnt bei der Basis am Tag der Anlage und endet am Ziel zum Termin;
  ohne Basis gilt der erste Wert. Verglichen wird der Wert des letzten Monats.
- Die Toleranz stellt der Käufer unter Einstellungen › Zyklus ein (`scorecard_setting`,
  käuferprivat). Die Lieferantenseite liest nur diese eine Zahl über `app_kpi_tolerance`
  (Migration 0050), damit beide Seiten denselben Stand sehen.
- Je Kennzahl und Monat ein Wert; ein neuer ersetzt den alten, der Verlauf hält beide fest.
  Werte erfasst die Seite, der die Kennzahl gehört; das prüft der Dienst.
- Import wie PLT-07 (CSV oder XLSX), Spalten Kennzahl, Monat, Wert; übernommen wird nur ohne
  fehlerhafte Zeilen.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Zwölf Monatswerte lassen sich in einem Schritt importieren, fehlerhafte Zeilen sind markiert.
- [x] Der Stand stimmt für beide Richtungen und die Grenzfälle.
- [x] Nur die verantwortliche Seite erfasst Werte.
- [x] Der Verlauf je Kennzahl ist für beide Seiten sichtbar.
- [x] Die Scorecard erscheint mit Ist-Werten live im Termin (QBR-01).

## Nicht Teil dieser Funktion

- Werte aus anderen Systemen (nach 1.0)
- GuV-Wirkung (PNL)
