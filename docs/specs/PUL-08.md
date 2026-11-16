# PUL-08 KI fasst Freitexte zu Themen zusammen

Release 1.0 · Soll · baut auf PUL-03, SEG-11 (`ai_draft`)

## Ziel

Beide Seiten bekommen die Freitexte einer Feedback-Welle als wenige Themen zusammengefasst, ohne Zitate einzelner Personen.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO bzw. Key Account Manager | Zusammenfassung der Freitexte der anderen Seite erzeugen, übernehmen, verwerfen. |
| Beide Seiten | Jeweils nur die eigene übernommene Zusammenfassung sehen. |

## Daten

- `ai_draft` mit `kind = feedback_themes`, `org_private` der erzeugenden Seite.
- Die KI bekommt nur Freitexte, die diese Seite nach PUL-03 sehen darf, also nur ab drei Antworten.
- **Vorgaben an die KI:** höchstens fünf Themen mit je einem Satz, keine wörtlichen Zitate, keine Funktionen oder Namen.

## Ablauf

1. Auf der Ergebnis-Seite erzeugt **Freitexte zusammenfassen** einen Entwurf, gekennzeichnet als KI-Entwurf.
2. Nach dem Übernehmen steht die Zusammenfassung über den Freitexten.

## Fertig, wenn

Je Kriterium ein Test, mit `AI_PROVIDER=test`.

- [x] Ohne mindestens drei Freitexte gibt es keinen Entwurf (`apps/api/src/modules/feedback/pul-08.test.ts`, `apps/web/src/features/feedback/pul-08.test.tsx`).
- [x] Die Ausgabe enthält keine Wortfolge von mehr als acht Wörtern aus einem Freitext (Prüfung auf Zitate) (`apps/api/src/modules/feedback/pul-08.test.ts`, `apps/api/src/modules/ai-drafts/quotes.test.ts`).
- [x] Jede Seite sieht nur ihre eigene Zusammenfassung (`apps/api/src/modules/feedback/pul-08.test.ts`).

## Umsetzung (16.11.2026)

- `ai_draft` mit `kind` `feedback_themes`, `object_type` `survey_wave`, `org_private` der Seite,
  die erzeugt. Die KI bekommt die Freitexte der anderen Seite aus `survey_free_text`, die es nach
  PUL-03 erst nach der Aufdeckung gibt; Namen sichtbarer Nutzer und Anreden ersetzt Reziproq wie
  in SEG-11 durch „[Person]“.
- Reziproq prüft jeden Entwurf vor dem Speichern auf Zitate (mehr als acht Wörter am Stück, ohne
  Groß- und Kleinschreibung und Satzzeichen). Zitiert er, fragt Reziproq ein zweites Mal mit
  strengerer Vorgabe; zitiert auch dieser, wird nichts gespeichert und die Seite sagt das.
- Höchstens fünf Themen: Reziproq schneidet weitere Zeilen ab.
- Erzeugen, Übernehmen und Verwerfen: Admin oder Teamrolle `sro` der eigenen Seite (beim
  Lieferanten der Key Account Manager). Den Entwurf sehen nur sie; die übernommene
  Zusammenfassung alle der eigenen Seite mit `feedback.sehen`.
- Die Zusammenfassung steht über den Freitexten, mit dem Satz „Nur eure Seite sieht diese
  Zusammenfassung.“ Sie geht nicht ins PDF des Ergebnisses, weil das PDF auf beiden Seiten gleich
  ist (QS-03).

## Nicht Teil dieser Funktion

- Stimmungsanalyse je Person oder Funktion
