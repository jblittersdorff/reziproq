# SEG-11 KI erklärt Abweichungen

Release 1.0 · Soll · baut auf SEG-05, PLT-12 (KI-Anbindung)

## Ziel

Als SRO bekomme ich zu den größten Abweichungen in der Segmentierung eine Erklärung in zwei Sätzen, abgeleitet aus den Begründungen der Bewertenden. Das spart mir das Lesen aller Kommentare vor der Konsolidierung.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Erklärung erzeugen, übernehmen, verwerfen. |
| Käufer mit Zugriff | Übernommene Erklärungen sehen. |
| Lieferant | Nie. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `ai_draft` | `id`, `org_id`, `kind` (hier `deviation_explanation`), `object_type`, `object_id`, `content`, `model`, `status` (`draft`, `accepted`, `discarded`), `created_by`, `created_at` | `org_private` |

- Gemeinsame Tabelle für alle KI-Entwürfe (auch PUL-08, SPL-10, QBR-07).
- Die KI bekommt nur Werte und Begründungen, die der SRO sehen darf, ohne Namen der Bewertenden.
- Anbieter und Modell wie in PLT-12. Echte Kundendaten nur über `bedrock`.

## Ablauf

1. Auf der Segmentierungsseite erzeugt **Abweichungen erklären** je der drei größten Abweichungen einen Entwurf von zwei Sätzen.
2. Der Entwurf trägt das Kennzeichen „KI-Entwurf, bitte prüfen“, mit **Übernehmen** und **Verwerfen**.
3. Übernommene Erklärungen stehen bei der Abweichung, verworfene verschwinden.

## Fertig, wenn

Je Kriterium ein Test, mit `AI_PROVIDER=test`.

- [x] Ein Entwurf ist sichtbar als Entwurf, bis er übernommen wird (`apps/api/src/modules/ratings/seg-11.test.ts`, `apps/web/src/features/segmentation/seg-11.test.tsx`, `apps/web/e2e/seg-11.spec.ts`).
- [x] Die Eingabe an die KI enthält keine Namen von Personen (Test über die erzeugte Anfrage) (`apps/api/src/modules/ratings/seg-11.test.ts`, `apps/api/src/modules/ai-drafts/anonymize.test.ts`).
- [x] Der Lieferant sieht keinen Entwurf (PLT-04) (`apps/api/src/modules/ratings/seg-11.test.ts`; `ai_draft` ist `org_private` und steht in den Ebenen-Tests).
- [x] Ohne Begründungen erzeugt Reziproq keinen Entwurf, sondern einen Hinweis (`apps/api/src/modules/ratings/seg-11.test.ts`, `apps/web/src/features/segmentation/seg-11.test.tsx`).

## Umsetzung (16.11.2026)

- `ai_draft` hat zusätzlich `relationship_id`, `subject`, `decided_by` und `decided_at`. Bei SEG-11
  ist das Objekt die Bewertungsrunde (`object_type` `segmentation_round`), `subject` das
  Kriterium. Kein Fremdschlüssel auf das Objekt, weil die Tabelle für mehrere Arten dient.
- „Größte Abweichungen“ sind die drei Kriterien mit der größten Spannweite der Ist-Werte
  (SEG-05), ohne Kriterien, bei denen alle gleich bewerten.
- An die KI gehen je Bewertung Business Unit, Warengruppe, Funktion, Ist-Wert und Begründung, nur
  aus den Bewertungen, die der SRO sehen darf. Namen aller sichtbaren Nutzer (ganz und je Teil ab
  drei Buchstaben) und Anreden wie „Herr Müller“ ersetzt Reziproq vorher durch „[Person]“.
- Der Hinweis ohne Begründungen ist ein Satz auf der Seite, kein Hinweis aus FS-01.
- Ein neuer Lauf ersetzt offene Entwürfe; übernommene Erklärungen bleiben, bis eine neue
  übernommen wird. Übernehmen und Verwerfen stehen im Verlauf (intern, ohne Text).
- Rechte wie beim Konsolidieren: `segmentierung.konsolidieren` und SRO der Beziehung oder Admin.
  Entwürfe sieht nur, wer erklären darf.
- Modell: gemeinsamer Baustein `apps/api/src/modules/ai-drafts` (Anbieter wie PLT-12, festes
  Testmodell bei `AI_PROVIDER=test`), auch für PUL-08, SPL-10 und QBR-07. Ins Protokoll kommen nur
  Dauer und Tokens.

## Nicht Teil dieser Funktion

- Vorschläge für Typen oder Bewertungen
