# PNL-11 Excel-Export für das Controlling

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: WK-01. Die Rechengrundlage (Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad, Monatswerte) gilt weiter und wird die Wert-Engine; Seiten nach WK-01 (Wert, Wertkonto, Mappe „Wirkung freigeben“). Beträge in Cent (E-K0-10), Wertart „strategisch“ ohne Euro (E-K0-11), Bestätigung durch das Controlling per Link oder mit Konto (E-K0-12). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

## Umsetzung

- Endpunkte `GET /wirkung/export` (Portfolio der Fokuslieferanten, optional `bu`) und
  `GET /suppliers/<id>/wirkung/export` (eine Beziehung), beide mit `sicht` und `gj` wie die Seiten.
- Controlling und Admins bekommen die ganze Auswahl, andere nur Beziehungen, in denen sie SRO sind;
  wer in keiner Beziehung SRO ist, bekommt 403.
- Die Übersicht rechnet mit denselben Bausteinen wie die Seite Wirkung (`pipelineOf`,
  `amountInRange`): je Wirkungsart eine Zeile nach Reifegrad und je Geschäftsjahr; eine Gesamtzeile
  gibt es nicht. Initiativen mit Savings-Verweis zählen nicht und stehen im Blatt Initiativen mit
  „zählt nicht“.
- Rechenweg zeigt je Monat und Art die jüngste Eingabe mit Regel und Version und den Betrag;
  Eingaben alphabetisch als `schlüssel=wert`. Beträge in Euro mit zwei Nachkommastellen
  (Zahlenformat), intern Cent.
- Dateiname aus Organisation, Auswahl und Datum, z. B. `Wirkung_OEM_GJ_2026_2026-11-15.xlsx`.
- Knopf „Excel herunterladen“ auf Wirkung und auf Lieferant › Wirkung › P&L-Brücke.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Der Export enthält Rechenweg, Baseline und Freigabe je Initiative.
- [x] Die Summen im Blatt Übersicht stimmen mit der Seite Wirkung überein.
- [x] Keine Summe über Wirkungsarten im ganzen Export.
- [x] Ein SRO bekommt nur seine Beziehungen.
- [x] Ein Test öffnet die Datei und prüft Blätter und Beispielwerte.

## Nicht Teil dieser Funktion

- Gesamtexport aller Daten (QS-03)
