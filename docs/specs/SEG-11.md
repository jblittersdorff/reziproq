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

- [ ] Ein Entwurf ist sichtbar als Entwurf, bis er übernommen wird.
- [ ] Die Eingabe an die KI enthält keine Namen von Personen (Test über die erzeugte Anfrage).
- [ ] Der Lieferant sieht keinen Entwurf (PLT-04).
- [ ] Ohne Begründungen erzeugt Reziproq keinen Entwurf, sondern einen Hinweis.

## Nicht Teil dieser Funktion

- Vorschläge für Typen oder Bewertungen
