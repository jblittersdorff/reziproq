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

- [ ] Ohne mindestens drei Freitexte gibt es keinen Entwurf.
- [ ] Die Ausgabe enthält keine Wortfolge von mehr als acht Wörtern aus einem Freitext (Prüfung auf Zitate).
- [ ] Jede Seite sieht nur ihre eigene Zusammenfassung.

## Nicht Teil dieser Funktion

- Stimmungsanalyse je Person oder Funktion
