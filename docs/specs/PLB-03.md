# PLB-03 Spielregeln je Beziehung

Release 0.2 · baut auf PLB-01, SEG-06

## Ziel

Als SRO lege ich für meinen Lieferanten fest, welche Rechte, Pflichten und Formate gelten. Reziproq schlägt sie aus dem Soll-Typ vor, und ich passe sie mit Begründung an.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Spielregeln vorschlagen lassen, auswählen, ergänzen, intern freigeben. |
| Käufer: alle mit Zugriff | Spielregeln sehen. |
| Lieferant | Sieht sie erst nach der Freigabe an ihn (SEG-10). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `rule_set` | `id`, `relationship_id`, `segment_type_id`, `version`, `status` (`draft`, `approved`, `shared`), `approved_by`, `approved_at` | `shared` mit `visibility` `internal`, bis SEG-10 sie teilt |
| `rule_set_item` | `rule_set_id`, `kind` (`right`, `obligation`, `format`), `group`, `title`, `description`, `cadence` (bei Formaten), `origin` (`catalog`, `custom`) | `shared` wie oben |
| `rule_set_note` | `rule_set_item_id`, `deviation_reason` | `buyer_private`. Interne Begründung für Abweichungen vom Katalog. |

- Der Vorschlag kommt aus dem Katalog (PLB-01) für den konsolidierten Soll-Typ.
- Freigegebene Versionen bleiben unverändert. Jede Änderung ergibt eine neue Version.

## Ablauf

1. **Lieferant › Beziehung › Spielregeln** (`/lieferanten/<id>/beziehung/spielregeln`) zeigt die aktuelle Version nach Gruppen:
   - Rechte und Pflichten nebeneinander
   - darunter die Formate mit Takt
   - Kennzeichen „Intern“ oder „Geteilt“
2. Ohne Spielregeln: Knopf **Vorschlag übernehmen**. Er legt einen Entwurf aus dem Katalog an.
3. **Bearbeiten** auf `/…/spielregeln/bearbeiten`:
   - Einträge abwählen oder eigene ergänzen
   - Jede Abweichung vom Katalog verlangt eine interne Begründung.
4. **Intern freigeben:** Der SRO bestätigt auf der Seite, die Version ist ab dann gesperrt.
5. Ändert sich der Soll-Typ (SEG-06), zeigt die Seite: „Der Soll-Typ hat sich geändert. Neuen Vorschlag ansehen.“ Der Vorschlag wird nur auf Klick zum Entwurf.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Der Vorschlag enthält genau die Katalogeinträge für den Soll-Typ.
- [ ] Ohne Begründung lässt sich eine Abweichung nicht speichern. Die Begründung sieht nur der Käufer.
- [ ] Eine freigegebene Version ist gesperrt, Änderungen erzeugen eine neue Version.
- [ ] Ein geänderter Soll-Typ zeigt den Hinweis und ändert nichts automatisch.
- [ ] Vor SEG-10 sieht der Test-Lieferant keine Spielregeln (PLT-04).

## Nicht Teil dieser Funktion

- Freigabe an den Lieferanten (SEG-10)
- Termine aus den Formaten anlegen (QBR-01)
