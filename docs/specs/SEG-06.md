# SEG-06 Konsolidierung

Release 0.1 · baut auf SEG-05, PLT-05

## Ziel

Als SRO lege ich die Unternehmenssicht auf einen Lieferanten fest: Ist und Soll, gesamt und je Business Unit und Warengruppe, jeweils mit Begründung. Frühere Stände bleiben nachvollziehbar.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO der Beziehung, Admin | Konsolidieren und neu konsolidieren. |
| Käufer: alle anderen | Das Ergebnis und den Verlauf sehen. |
| Lieferant | Nie, außer dem freigegebenen Soll-Typ (SEG-10). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `segment_decision` | `id`, `relationship_id`, `scope` (`total`, `bu_mg`), `business_unit_id`, `material_group_id`, `ist_type_id`, `soll_type_id`, `reason`, `model_version`, `decided_by`, `decided_at`, `version` | `buyer_private` |

- Jede Konsolidierung schreibt neue Zeilen mit höherer `version`. Alte Zeilen bleiben unverändert.
- Ab der ersten Konsolidierung gilt die Sichtregel nach SEG-04: Alle Käufer-Nutzer mit Zugriff sehen alle Bewertungen.

## Ablauf

1. Der SRO klickt auf der Segmentierungsseite (SEG-05) auf **Konsolidieren**.
2. Der Ablauf `/…/segmentierung/konsolidieren` hat eine Seite je BU und Warengruppe:
   - Vorgeschlagen sind die vorläufigen Typen aus den Bewertungen.
   - Daneben stehen die größten Abweichungen.
   - Der SRO wählt Ist-Typ und Soll-Typ und schreibt eine Begründung. Die Begründung ist Pflicht.
3. Letzte Seite **Gesamt**: Der SRO legt Ist und Soll für den Lieferanten insgesamt fest, mit Begründung, und klickt auf **Festlegen**.
4. Danach zeigen der Kopf (NAV-07), die Segmentierungsseite und das Portfolio die konsolidierten Typen.
5. Der Verlauf auf der Segmentierungsseite zeigt jede Version mit Datum, Person, Typen und Begründung.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Ohne Begründung lässt sich nicht festlegen.
- [x] Eine neue Konsolidierung erzeugt eine neue Version. Die alte bleibt unverändert lesbar.
- [x] Nach dem Festlegen zeigt der Kopf Ist → Soll gesamt.
- [x] Nach dem Festlegen sehen alle Käufer-Nutzer mit Zugriff alle Bewertungen.
- [x] Nur SRO und Admin konsolidieren. Alle anderen bekommen 403.
- [x] Der Zweit-OEM und der Test-Lieferant sehen nichts davon (PLT-04).

## Nicht Teil dieser Funktion

- Freigabe des Soll-Typs an den Lieferanten (SEG-10)
- Spielregeln aus dem Soll-Typ (PLB-03)
