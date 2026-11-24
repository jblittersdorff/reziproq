# PNL-07 Teilungsregel, Wirkungsarten und Doppelzählung

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: WK-01. Die Rechengrundlage (Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad, Monatswerte) gilt weiter und wird die Wert-Engine; Seiten nach WK-01 (Wert, Wertkonto, Mappe „Wirkung freigeben“). Beträge in Cent (E-K0-10), Wertart „strategisch“ ohne Euro (E-K0-11), Bestätigung durch das Controlling per Link oder mit Konto (E-K0-12). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.3 · baut auf PNL-06, LIF-03 · deckt ab PNL-07, PNL-08, PNL-09

## Ziel

Beide Seiten sehen die vereinbarte Wirkung und wie sie geteilt wird. Interne Zahlen bleiben auf ihrer Seite. EBIT-Wirkung, Kostenvermeidung, Cash und strategischer Wert werden nie addiert. Nichts wird doppelt gezählt.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO und Key Account Manager | Teilungsregel je Initiative vereinbaren. |
| Lieferant | Den eigenen Nutzen in seiner privaten Sicht erfassen. |
| SRO | Referenz auf das Savings-Tracking setzen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `initiative_share` | `initiative_id`, `buyer_share_pct`, `supplier_share_pct`, `rule_text`, `agreed_at` | `shared` |
| `supplier_benefit` | `initiative_id`, `month`, `amount_cents`, `currency`, `note` | `supplier_private` |
| `savings_reference` | `initiative_id`, `system`, `reference`, `created_by` | `buyer_private` |

**Sichtbarkeit:**

| Was | Wer sieht es |
|---|---|
| Vereinbarte Wirkung (`initiative_value`) und Anteile | beide Seiten |
| Mengen, Preise, Kostensätze, Baseline | nur der Käufer |
| Nutzen des Lieferanten | nur der Lieferant |

**Regeln:**

- **Wirkungsarten:** Jede Summe gilt genau einer Wirkungsart. Oberfläche, API und Export bilden keine Summe über Arten hinweg.
- **Doppelzählung:** Initiativen mit `savings_reference` erscheinen markiert und zählen in keiner Summe.

## Ablauf

1. Auf der Wirkungs-Seite: Abschnitt **Teilung**, bearbeitet auf eigener Seite. Beide Seiten bestätigen.
2. Beim Lieferanten liegt die Wirkung unter `/kunden/<beziehung>/wirkung`:
   - geteilte Wirkung und Anteile
   - Abschnitt **Eigener Nutzen** mit Kennzeichen „Nur für Sie sichtbar“
3. Alle Summen stehen getrennt je Wirkungsart als eigene Kacheln.
4. **Savings-Referenz:** Feld auf der Wirkungs-Seite. Die Initiative trägt dann „bereits im Savings-Tracking“.

## Umsetzung

- `initiative_share` ist geteilt und gehört dem Käufer. Der SRO (oder ein Admin) schlägt Anteile in
  ganzen Prozent vor (Summe 100, geprüft auch in der Datenbank); der Vorschlag gilt als Zustimmung
  des Käufers. Der Key Account Manager (oder ein Admin des Lieferanten) bestätigt über die Funktion
  `app_initiative_share_confirm`. Jede Änderung durch den Käufer setzt die Bestätigung zurück.
- `initiative_value` bleibt intern, bis die Teilung vereinbart ist; `app_initiative_recompute`
  setzt die Sichtbarkeit aus der Vereinbarung, auch für gesperrte Monate. So sieht der Lieferant
  nur vereinbarte Wirkung, nie Mengen, Preise oder Baseline.
- Summen nur je Wirkungsart (`totals` als Liste je Art), in API und Oberfläche; eine Gesamtsumme
  gibt es nicht. Beim Käufer zählen Initiativen mit `savings_reference` in keiner Summe und tragen
  „bereits im Savings-Tracking“. Der Verweis ist käuferprivat; der Lieferant erfährt nichts davon.
- `supplier_benefit` ist lieferantenprivat, je Initiative und Monat einmal, mit Kennzeichen „Nur für
  Sie sichtbar“, und wird nie mit der vereinbarten Wirkung addiert.
- Neues Recht `teilung.vereinbaren` (Admin, Nutzer; nicht mit Teamrolle Leser). Der eigene Nutzen
  nutzt `eigene_sicht.bearbeiten` aus LIF-03.
- Seiten: Abschnitte Teilung und Savings-Tracking auf der Wirkungs-Seite einer Initiative,
  bearbeitet unter `…/initiativen/<id>/teilung` und `…/savings`; beim Lieferanten
  `/kunden/<beziehung>/wirkung` und `…/initiativen/<id>/nutzen`.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Tests belegen für jede Tabelle die Sichtbarkeit je Seite (PLT-04).
- [x] Keine Schnittstelle liefert eine Summe über mehrere Wirkungsarten.
- [x] Initiativen mit Savings-Referenz zählen in keiner Summe und sind markiert.
- [x] Die Anteile ergeben zusammen 100 %.
- [x] Der Käufer sieht den eigenen Nutzen des Lieferanten nie.

## Nicht Teil dieser Funktion

- Brücke und Portfolio (PNL-10)
- Abgleich mit Coupa oder Sievo (nach 1.0)
