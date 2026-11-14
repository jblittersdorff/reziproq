# PUL-06 Maßnahmen aus Lücken und Verlauf

Release 0.3 · baut auf PUL-03, QBR-03 · deckt ab PUL-06, PUL-07

## Ziel

Aus einer Wahrnehmungslücke wird mit einem Klick eine Maßnahme. Beide Seiten sehen „Ihr habt gesagt, wir haben gehandelt“. Über mehrere Wellen wird sichtbar, ob sich die Beziehung verbessert.

## Wer darf was

| Rolle | Darf |
|---|---|
| Team-Mitglieder beider Seiten | Aus einer Lücke eine Maßnahme anlegen. |
| Beide Seiten | Maßnahmen zur Welle und den Verlauf sehen. |

## Daten

- Keine neuen Tabellen.
- Die Maßnahme (QBR-03) bekommt `source_type = feedback_gap` und `source_id` = Ergebniszeile (`survey_result`, geteilt).

## Ablauf

1. Auf der Ergebnis-Seite (PUL-03) trägt jede der drei größten Lücken und jede Dimension den Knopf **Maßnahme anlegen**. Er öffnet die Seite für eine neue Maßnahme, vorbefüllt mit Dimension und Lücke.
2. **Ihr habt gesagt, wir haben gehandelt:** Ein Abschnitt auf der Ergebnis-Seite listet alle Maßnahmen zu dieser Welle mit Status.
3. **Verlauf:** Ab zwei aufgedeckten Wellen zeigt die Feedback-Seite je Dimension eine Linie des Ist-Werts beider Seiten über die Wellen. Puls und Jahres-Feedback sind getrennt.

## Umsetzung

- Quelle der Maßnahme ist die Ergebniszeile der Dimension (gesamt, Käuferseite; ohne Käuferzeile die
  des Lieferanten). Die API prüft, dass sie zur Beziehung gehört und keine Funktions- oder
  Fragezeile ist. Die Maßnahme trägt dazu `sourceDimension`, damit Listen „Feedback-Lücke:
  Transparenz“ zeigen.
- „Maßnahme anlegen“ führt zur Seite für eine neue Maßnahme der eigenen Seite mit
  `?luecke=<Ergebniszeile>&dimension=<Dimension>`; Titel „Lücke … schließen“ ist vorbefüllt.
  Angezeigt nur für Personen, die Maßnahmen anlegen dürfen (wie QBR-03), und nur im Gesamtbild,
  nicht je Funktion.
- „Ihr habt gesagt, wir haben gehandelt“ liest die Maßnahmen mit dieser Quelle über die normale
  Mandanten-Session; interne Maßnahmen der anderen Seite filtert RLS heraus.
- Verlauf: in der Liste der Wellen je Art ab zwei aufgedeckten Wellen, je Dimension ein kleines
  Diagramm (eure Seite durchgezogen, Lieferant gestrichelt) mit allen Werten als Tabelle darunter.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Eine Maßnahme aus einer Lücke trägt die richtige Quelle und erscheint in der Maßnahmenliste und im Abschnitt der Welle.
- [x] Der Verlauf zeigt ab zwei Wellen die richtigen Werte und vermischt Puls und Jahres-Feedback nicht.
- [x] Beide Seiten sehen denselben Abschnitt „Ihr habt gesagt, wir haben gehandelt“. Interne Maßnahmen erscheinen dort nur für die eigene Seite.

## Nicht Teil dieser Funktion

- KI-Themen aus Freitext (PUL-08)
