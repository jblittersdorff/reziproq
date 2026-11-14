# PUL-03 Auswertung und Wahrnehmungslücken

Release 0.2 · baut auf PUL-02, LIF-02 · deckt ab PUL-03, PUL-04, PUL-05

## Ziel

Beide Seiten sehen gleichzeitig, wie sie die Beziehung wahrnehmen und wo die größten Lücken liegen. Niemand kann eine Antwort einer Person zuordnen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Beide Seiten | Nach der Aufdeckung dieselbe Auswertung sehen. |
| Niemand | Ergebnisse vor der Aufdeckung sehen, auch nicht die eigenen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `survey_result` | `wave_id`, `side`, `dimension`, `function` (leer = gesamt), `question_id` (leer = Dimension), `ist_mean`, `soll_mean`, `n` | `shared`, entsteht bei der Aufdeckung |

- **Aufdeckung:** sobald beide Seiten abgeschlossen haben oder die Frist abgelaufen ist und jede Seite mindestens drei Antworten hat. Dann entsteht `survey_result`, und `revealed_at` wird gesetzt.
- **Anonymität:** Eine Gruppe (Seite, Funktion) erscheint nur ab drei Antworten. Kleinere Gruppen fließen nur in „gesamt“ ein.
- **Freitexte:** Jede Seite sieht die Freitexte der anderen nur ab drei Antworten, ohne Funktion und in zufälliger Reihenfolge.
- **Lücke** je Dimension: Unterschied zwischen dem Ist des Käufers und dem Ist des Lieferanten, dazu jeweils der Abstand zum eigenen Soll.

## Ablauf

1. **Ergebnis-Seite** (`/…/beziehung/feedback/<welle>`), nach der Aufdeckung für beide Seiten gleich:
   - **Hantel-Diagramm:** je Dimension zwei Punkte (Ist Käufer, Ist Lieferant) und ihre Soll-Werte als Markierung. Sortiert nach der größten Lücke.
   - **Die drei größten Lücken** stehen oben als Kacheln.
   - **Je Funktion:** gleiches Diagramm, nur Gruppen ab drei Antworten
   - **Freitexte** der jeweils anderen Seite
2. Vor der Aufdeckung zeigt die Seite nur den Rücklauf und „Ergebnisse erscheinen, wenn beide Seiten abgeschlossen haben“.
3. Danach ist der Zyklus-Schritt Feedback erledigt (ZYK-01). Die Kachel im Lieferantenplan zeigt die größte Lücke.

## Umsetzung

- Die Aufdeckung rechnet einmal in der Datenbank (`app_survey_reveal`, Rolle `reziproq_feedback`):
  `survey_result` (geteilt, nur berechnet) und `survey_free_text` (geteilt, zufällige Reihenfolge,
  ohne Funktion). Die App darf beide nur lesen. Ausgelöst wird sie beim Lesen oder Abschließen
  einer Welle, sobald die Bedingungen erfüllt sind; ein Job ist dafür nicht nötig.
- Ist eine Seite unter drei Antworten, wird auch nach der Frist nicht aufgedeckt; die Seite sagt
  das („Zu wenige Antworten“).
- Je Funktion stehen nur Dimensionen, keine einzelnen Fragen, damit kleine Gruppen nicht über
  Fragen erkennbar werden. Die Texte der Fragen stehen im Ergebnis, weil die Vorlage käuferprivat
  ist.
- Die Lücke heißt im Code `delta` (Ist Käufer − Ist Lieferant). Das Diagramm unterscheidet die
  Seiten über Form (Punkt, Ring), Soll über Striche und nennt alle Werte als Text.
- Die größte Lücke erscheint in der Wellen-Liste, in der Kachel Feedback des Lieferantenplans und
  live in der JBP-Vorbereitung (JBP-01).

## Fertig, wenn

Je Kriterium ein Test.

- [x] Vor der Aufdeckung liefert keine Schnittstelle Ergebnisse, auch nicht der eigenen Seite.
- [x] Gruppen unter drei Antworten fehlen in jeder Ausgabe (Test mit zwei Antworten).
- [x] Die drei größten Lücken stehen oben und stimmen mit Testdaten.
- [x] Beide Seiten sehen nach der Aufdeckung dieselben Zahlen.
- [x] Das Diagramm ist mit fünf Dimensionen und sechs Funktionen lesbar und nicht nur über Farbe unterscheidbar.
- [x] Die Aufdeckung erledigt den Zyklus-Schritt Feedback.

## Nicht Teil dieser Funktion

- Maßnahme aus einer Lücke (PUL-06)
- Verlauf über Wellen (PUL-06)
- KI-Themen aus Freitext (PUL-08)
