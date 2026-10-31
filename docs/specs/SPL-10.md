# SPL-10 KI-Entwurf der Strategie-Zusammenfassung

Release 1.0 · Soll · baut auf SPL-07, SEG-11 (`ai_draft`)

## Ziel

Als SRO bekomme ich aus Zielen, Themen, Feedback-Ergebnis und Profil einen Entwurf der Strategie-Zusammenfassung für den Lieferantenplan. Ich überarbeite ihn, statt bei null zu beginnen.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Entwurf erzeugen, übernehmen, verwerfen. |
| Lieferant | Nie. |

## Daten

- `ai_draft` mit `kind = plan_summary`, `org_private` der Käuferorganisation.
- **Eingabe:**
  - Ziele, Themen, Soll-Typ
  - größte Feedback-Lücken
  - Spend-Entwicklung
  - Kennzahlen aus Profil und Finanzen
- Keine Namen von Personen.

## Ablauf

1. Auf der Seite Zusammenfassung bearbeiten (SPL-01) erzeugt **Entwurf vorschlagen** einen Text mit höchstens 120 Wörtern, gekennzeichnet als KI-Entwurf.
2. **Übernehmen** setzt ihn in das Feld. Der SRO bearbeitet ihn und speichert normal.

## Fertig, wenn

Je Kriterium ein Test, mit `AI_PROVIDER=test`.

- [ ] Der Entwurf wird erst mit dem normalen Speichern Teil des Plans.
- [ ] Die Eingabe an die KI enthält keine Namen von Personen.
- [ ] Der Entwurf überschreitet nie 120 Wörter.

## Nicht Teil dieser Funktion

- KI-Vorschläge für Ziele oder Themen
