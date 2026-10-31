# QBR-07 KI-Entwurf für den Pre-Read

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

- [ ] Interne Bewertungen, Lieferantenplan und interne Notizen erscheinen nie im Entwurf des Lieferanten (Test über die Eingabe an die KI).
- [ ] Der übernommene Entwurf erscheint nur im PDF der eigenen Seite.
- [ ] Der Entwurf überschreitet nie 200 Wörter.

## Nicht Teil dieser Funktion

- Protokoll-Entwurf nach dem Termin
