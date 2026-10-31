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

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ohne Freigabe gibt es kein R5.
- [ ] Nur Nutzer mit Zusatzrolle Controlling geben frei, alle anderen bekommen 403.
- [ ] Die Freigabe sperrt die Monatswerte des Zeitraums.
- [ ] Zurückweisen verlangt eine Begründung und benachrichtigt den SRO.
- [ ] Die Prüfseite zeigt den vollständigen Rechenweg.

## Nicht Teil dieser Funktion

- Excel-Export (PNL-11)
