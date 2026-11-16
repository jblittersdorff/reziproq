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

- [x] Der Entwurf wird erst mit dem normalen Speichern Teil des Plans (`apps/api/src/modules/supplier-plans/spl-10.test.ts`, `apps/web/src/features/supplier-plan/spl-10.test.tsx`).
- [x] Die Eingabe an die KI enthält keine Namen von Personen (`apps/api/src/modules/supplier-plans/spl-10.test.ts`).
- [x] Der Entwurf überschreitet nie 120 Wörter (`apps/api/src/modules/supplier-plans/spl-10.test.ts`).

## Umsetzung (16.11.2026)

- `ai_draft` mit `kind` `plan_summary`, `object_type` `supplier_plan`, nur beim Käufer
  (`org_private`). Erzeugen, Übernehmen und Verwerfen: SRO der Beziehung oder Admin, solange der
  Plan ein Entwurf ist; der Lieferant bekommt 403.
- Eingabe: Soll-Typ, Ziele mit Kategorie und Zieljahr (ohne Verantwortliche), Themen mit
  Begründung, die drei größten Lücken der letzten aufgedeckten Feedback-Welle, Ist-Spend der
  letzten drei Jahre, Mitarbeitende und Geschäftsfelder aus dem Profil, Umsatz und EBIT-Marge des
  letzten Jahres. Namen sichtbarer Nutzer und Anreden ersetzt Reziproq wie in SEG-11 durch
  „[Person]“.
- Schreibt die KI mehr als 120 Wörter, kürzt Reziproq am letzten vollständigen Satz, sonst mit „…“.
- „Übernehmen“ markiert den Entwurf als übernommen und setzt den Text ins Feld; der Plan ändert
  sich erst mit „Speichern“ (PATCH der Zusammenfassung, mit Verlauf wie bisher).

## Nicht Teil dieser Funktion

- KI-Vorschläge für Ziele oder Themen
