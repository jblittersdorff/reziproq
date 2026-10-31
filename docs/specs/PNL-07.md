# PNL-07 Teilungsregel, Wirkungsarten und Doppelzählung

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

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Tests belegen für jede Tabelle die Sichtbarkeit je Seite (PLT-04).
- [ ] Keine Schnittstelle liefert eine Summe über mehrere Wirkungsarten.
- [ ] Initiativen mit Savings-Referenz zählen in keiner Summe und sind markiert.
- [ ] Die Anteile ergeben zusammen 100 %.
- [ ] Der Käufer sieht den eigenen Nutzen des Lieferanten nie.

## Nicht Teil dieser Funktion

- Brücke und Portfolio (PNL-10)
- Abgleich mit Coupa oder Sievo (nach 1.0)
