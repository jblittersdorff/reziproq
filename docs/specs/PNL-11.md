# PNL-11 Excel-Export für das Controlling

Release 0.3 · baut auf PNL-10

## Ziel

Als Controlling lade ich alle Wirkungen mit Rechenweg, Baseline und Freigabe als Excel-Datei herunter und kann jede Zahl nachrechnen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Controlling, Admin | Export für alle Beziehungen. |
| SRO | Export für eigene Beziehungen. |
| Lieferant | Nicht Teil. |

## Daten

- Keine neuen Tabellen.
- Erzeugt mit ExcelJS (MIT), Version fest gepinnt.

**Blätter der Datei:**

| Blatt | Inhalt |
|---|---|
| Übersicht | Summen je Wirkungsart, Reifegrad und Geschäftsjahr |
| Initiativen | Beziehung, Initiative, Hebel, GuV-Zeile, Wirkungsart, Reifegrad, Savings-Referenz |
| Monatswerte | Plan und Ist je Monat mit Betrag |
| Rechenweg | Rechenregel mit Version und Eingaben je Monat |
| Baseline | Version, Eingaben, Datum, Person, Begründung |
| Freigaben | Zeitraum, Status, Person, Datum, Kommentar |

Beträge stehen in Euro mit zwei Nachkommastellen. Intern bleiben sie Cent.

## Ablauf

1. Auf **Wirkung** und auf Lieferant › Wirkung erzeugt **Excel herunterladen** die Datei für die aktuelle Auswahl: Geschäftsjahr, BU, Lieferant.
2. Der Dateiname enthält Organisation, Auswahl und Datum.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Der Export enthält Rechenweg, Baseline und Freigabe je Initiative.
- [ ] Die Summen im Blatt Übersicht stimmen mit der Seite Wirkung überein.
- [ ] Keine Summe über Wirkungsarten im ganzen Export.
- [ ] Ein SRO bekommt nur seine Beziehungen.
- [ ] Ein Test öffnet die Datei und prüft Blätter und Beispielwerte.

## Nicht Teil dieser Funktion

- Gesamtexport aller Daten (QS-03)
