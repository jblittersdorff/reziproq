# SEG-02 Fokuslieferanten

Release 0.1 · baut auf SEG-07

## Ziel

Als Leitung des Lieferantenmanagements lege ich bewusst fest, welche Lieferanten den Jahreszyklus mit Lieferantenplan und Joint Business Planning durchlaufen. Spend allein reicht dafür nicht.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Fokus setzen und entfernen, mit Begründung. |
| Käufer: alle anderen | Fokusliste und Begründungen sehen. |
| Lieferant | Erfährt nicht, ob er Fokuslieferant ist. |

## Daten

- `relationship_side` (Käuferseite, aus PLT-03) bekommt diese Felder: `is_focus`, `focus_reason`, `focus_set_by`, `focus_set_at`.
- Änderungen stehen im internen Verlauf.
- **Vorschlag**, nie automatisch gesetzt:
  - Lieferanten, die zusammen einen je Kunde einstellbaren Anteil des Spends ausmachen, oder
  - Lieferanten mit hohem Business Impact im konsolidierten Soll-Typ.
- Der Vorschlag zeigt, welche der beiden Regeln greift.

## Ablauf

1. **Portfolio › Fokuslieferanten** (`/portfolio/fokus`) hat zwei Listen:
   - **Fokus**, mit Begründung
   - **Vorschläge**, mit Grund: Spend-Anteil oder Soll-Typ
2. Ein Klick auf einen Lieferanten öffnet `/portfolio/fokus/<beziehung>`. Dort stehen:
   - Spend und Anteil
   - Ist- und Soll-Typ
   - Schalter **Fokuslieferant**
   - Begründung (Pflicht)
   - Speichern
3. Fokuslieferanten tragen in Liste, Karte und Kopf ein dezentes Abzeichen „Fokus“.
4. Ab ZYK-01 bekommt jeder Fokuslieferant einen Zyklus.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ohne Begründung lässt sich der Fokus nicht setzen und nicht entfernen.
- [ ] Der Vorschlag nennt mit Testdaten die richtigen Lieferanten und den richtigen Grund.
- [ ] Kein Lieferant wird ohne Klick eines Admins Fokuslieferant.
- [ ] Der Test-Lieferant sieht das Feld nie (PLT-04).
- [ ] Die Änderung steht im internen Verlauf.

## Nicht Teil dieser Funktion

- Zyklus anlegen (ZYK-01)
- Hinweis bei zu vielen Fokuslieferanten je SRO (FS-01)
