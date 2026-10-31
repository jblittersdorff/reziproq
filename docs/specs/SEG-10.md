# SEG-10 Beziehungstyp und Spielregeln an den Lieferanten freigeben

Release 0.2 · baut auf SEG-06, PLB-03, LIF-02 · deckt ab SEG-10, PLB-07

## Ziel

Als SRO teile ich mit dem Lieferanten, welche Beziehung wir anstreben und welche Rechte und Pflichten dazu gehören. Unsere Bewertungen und Begründungen bleiben intern.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Ziel-Typ und Spielregeln freigeben, neue Version freigeben. |
| Lieferant | Den freigegebenen Typ mit Beschreibung und die freigegebenen Spielregeln sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `relationship_target` | `relationship_id`, `type_name`, `type_description`, `rule_set_version`, `shared_at`, `shared_by` | `shared` |

- Name und Beschreibung des Typs werden bei der Freigabe als Stand übernommen. Sie bleiben stabil, auch wenn der Käufer sein Modell später umbenennt.
- `rule_set` und `rule_set_item` der freigegebenen Version bekommen `visibility = shared`.
- `rule_set_note` bleibt käuferprivat.
- Bewertungen, Ist-Typ und Begründungen werden nie geteilt.

## Ablauf

1. **Lieferant › Beziehung › Spielregeln** zeigt den Knopf **Mit Lieferant teilen**. Er öffnet `/…/spielregeln/teilen`:
   - Vorschau genau so, wie der Lieferant sie sehen wird: Soll-Typ mit Beschreibung, Rechte, Pflichten, Formate
   - Bestätigung auf der Seite
2. Der Lieferant sieht danach:
   - im Überblick den Beziehungstyp im Kopf
   - unter Beziehung › Spielregeln die geteilte Version, gekennzeichnet als „Geteilt am …“
3. Eine neue Version muss erneut geteilt werden. Bis dahin sieht der Lieferant die alte.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nach dem Teilen sieht der Lieferant genau Typ, Beschreibung und die Spielregeln dieser Version, sonst nichts aus Segmentierung oder Spielregeln.
- [ ] Bewertungen, Ist-Typ und Begründungen sind für den Lieferanten in keiner Schnittstelle sichtbar.
- [ ] Eine spätere Umbenennung des Typs ändert die geteilte Beschreibung nicht.
- [ ] Eine neue Version bleibt intern, bis sie geteilt wird.

## Nicht Teil dieser Funktion

- Rückmeldung des Lieferanten zu den Spielregeln (über Kommentare, QS-02)
