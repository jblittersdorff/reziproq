# QBR-07 KI-Entwurf für den Pre-Read

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: TE-01, KI-07, LP-01. Die Vorbereitung des Lieferanten steht privat in seinem Termin (`L5-Termin`). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 1.0 · Soll · baut auf QBR-06, SEG-11 (`ai_draft`)

## Ziel

Jede Seite bekommt vor einem Termin einen kurzen Entwurf mit Stand, Erfolgen und offenen Punkten. Er ist getrennt für Käufer und Lieferant, damit nichts Internes zur anderen Seite gelangt.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO bzw. Key Account Manager | Entwurf für die eigene Seite erzeugen, übernehmen, verwerfen. |
| Andere Seite | Sieht den Entwurf nie. |

## Daten

- `ai_draft` mit `kind = pre_read`, `org_private` der erzeugenden Seite.
- Die KI bekommt nur, was die erzeugende Seite sehen darf:
  - Scorecard
  - Initiativen
  - Zusagen
  - Maßnahmen
  - beim Käufer zusätzlich interne Notizen und Lieferantenplan
- Ein übernommener Entwurf erscheint im Pre-Read-PDF (QBR-06) der eigenen Seite als Abschnitt „Zusammenfassung“.

## Ablauf

1. Auf der Termin-Seite erzeugt **Zusammenfassung vorschlagen** einen Entwurf mit höchstens 200 Wörtern.
2. Übernehmen, bearbeiten, verwerfen wie bei SPL-10.

## Fertig, wenn

Je Kriterium ein Test, mit `AI_PROVIDER=test`.

- [x] Interne Bewertungen, Lieferantenplan und interne Notizen erscheinen nie im Entwurf des Lieferanten (Test über die Eingabe an die KI) (`apps/api/src/modules/meetings/qbr-07.test.ts`).
- [x] Der übernommene Entwurf erscheint nur im PDF der eigenen Seite (`apps/api/src/modules/meetings/qbr-07.test.ts`).
- [x] Der Entwurf überschreitet nie 200 Wörter (`apps/api/src/modules/meetings/qbr-07.test.ts`, `apps/web/src/features/meetings/qbr-07.test.tsx`).

## Umsetzung (16.11.2026)

- `ai_draft` mit `kind` `pre_read`, `object_type` `meeting`, `org_private` der erzeugenden Seite.
- Eingabe: Termin, Agenda und die Live-Abschnitte (Scorecard, Initiativen, Zusagen, Maßnahmen)
  genau so, wie die eigene Seite sie über RLS sieht (QBR-06). Nur beim Käufer zusätzlich die
  eigene interne Notiz und der Lieferantenplan des laufenden Zyklus (Zusammenfassung und Ziele).
  Beim Lieferanten geht auch seine eigene interne Notiz nicht mit, wie die Spec es vorsieht.
  Interne Bewertungen (Segmentierung) gehören nicht zum Pre-Read und gehen nie mit. Namen
  sichtbarer Nutzer und der Teilnehmenden ersetzt Reziproq durch „[Person]“.
- Schreibt die KI mehr als 200 Wörter, kürzt Reziproq am letzten vollständigen Satz.
- „Übernehmen, bearbeiten, verwerfen wie bei SPL-10“: Der Entwurf steht in einem Textfeld und
  lässt sich vor dem Übernehmen bearbeiten; übernommen wird der bearbeitete Text. Mehr als 200
  Wörter lehnt die API ab (400), die Seite zählt mit.
- Erzeugen, Übernehmen und Verwerfen: Admin oder Teamrolle `sro` der eigenen Seite (beim
  Lieferanten der Key Account Manager). Den Bereich gibt es nur bei nicht abgeschlossenen
  Terminen.
- Im PDF steht die übernommene Zusammenfassung als Abschnitt „Zusammenfassung“ direkt nach dem
  Deckblatt.

## Nicht Teil dieser Funktion

- Protokoll-Entwurf nach dem Termin
