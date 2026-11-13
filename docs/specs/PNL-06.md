# PNL-06 Freigabe durch Controlling

Release 0.3 · baut auf PNL-05, PLT-05

## Ziel

Als Controlling prüfe ich Rechenweg, Baseline und Ist-Werte einer Wirkung und gebe sie frei. Erst dann zählt sie als realisiert, und die Zahlen sind gesperrt.

## Wer darf was

| Rolle | Darf |
|---|---|
| Nutzer mit Zusatzrolle Controlling | Freigeben oder mit Begründung zurückweisen. |
| SRO | Freigabe anfordern. |
| Alle anderen | Status sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `initiative_validation` | `initiative_id`, `period_from`, `period_to`, `status` (`requested`, `approved`, `rejected`), `requested_by`, `decided_by`, `decided_at`, `comment` | `buyer_private` |

- Eine Freigabe sperrt die Monatswerte des Zeitraums und erlaubt R5 (PNL-03).
- Die geteilte Sicht des Lieferanten zeigt nur „realisiert und bestätigt“ ohne Details der Prüfung.

## Ablauf

1. Auf der Wirkungs-Seite klickt der SRO auf **Freigabe anfordern** und wählt einen Zeitraum. Controlling bekommt eine Mail und eine Aufgabe auf Start.
2. **Wirkung › Freigaben** (`/wirkung/freigaben`): Liste offener Anfragen für Controlling.
3. **Prüfseite** (`/wirkung/freigaben/<id>`):
   - Rechenregel mit Version
   - Baseline
   - Monatswerte mit Eingaben
   - berechnete Beträge
   - Nachweise der Stufen
   - Knöpfe **Freigeben** und **Zurückweisen**, Zurückweisen mit Pflichtbegründung
4. Nach der Freigabe ist die Initiative R5, und der Zeitraum ist gesperrt.

## Umsetzung

- Neues Recht `wirkung.freigeben` mit Kennzeichen `controlling`: `can()` verlangt dafür die
  Zusatzrolle Controlling, unabhängig von der Rolle in der Organisation (siehe `docs/rechte.md`).
- Anfordern geht ab R4 und nur mit Ist-Werten im Zeitraum. Controlling bekommt die Mail
  `approval` und eine Aufgabe auf Start (Art `validation`, sieben Tage).
- Die Freigabe legt die Stufe R5 mit dem teilbaren Nachweis „Realisiert und durch Controlling
  bestätigt“ an und rechnet neu; die Monate des Zeitraums sind danach gesperrt (API 409).
- Zurückweisen schickt dem anfordernden SRO die Mail `escalation` mit dem Titel
  „Wirkung zurückgewiesen: …“; eine eigene Vorlage folgt bei Bedarf.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Ohne Freigabe gibt es kein R5.
- [x] Nur Nutzer mit Zusatzrolle Controlling geben frei, alle anderen bekommen 403.
- [x] Die Freigabe sperrt die Monatswerte des Zeitraums.
- [x] Zurückweisen verlangt eine Begründung und benachrichtigt den SRO.
- [x] Die Prüfseite zeigt den vollständigen Rechenweg.

## Nicht Teil dieser Funktion

- Excel-Export (PNL-11)
