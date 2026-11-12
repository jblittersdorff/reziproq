# PNL-01 Wirkung einrichten und Hebel-Vorlagen

Release 0.3 · baut auf JBP-03, QBR-03 · deckt ab PNL-01, PNL-02, JBP-10

## Ziel

Als SRO lege ich für jede Initiative fest, über welchen Hebel und in welcher GuV-Zeile sie wirkt. Der Wert rechnet sich aus einer festen Vorlage, nicht von Hand.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Team-Mitglieder des Käufers | Wirkung einrichten, Hebel und GuV-Zeile wählen. |
| Lieferant | Initiativen als Idee vorschlagen (Quelle Lieferantenidee) und die geteilte Wirkung sehen (PNL-07). |
| Admin | GuV-Zeilen der Organisation pflegen. |

## Daten

`initiative` (aus JBP-03) bekommt diese Felder:

| Feld | Bedeutung |
|---|---|
| `lever` | `price`, `cost_avoidance`, `quality`, `logistics`, `working_capital`, `innovation`, `risk` |
| `lever_template_version` | Version der Rechenregel |
| `pnl_line_key` | GuV-Zeile |
| `effect_type` | `ebit`, `cost_avoidance`, `cash`, `strategic` |
| `maturity` | R1 bis R5, Start R1 |
| `source` | `jbp`, `action`, `supplier_idea` |
| `effective_from` | Beginn der Wirkung |

| Tabelle | Felder | Art |
|---|---|---|
| `pnl_line` | `org_id`, `key`, `name`, `position`, `active` | `org_private` |

- **Standard-GuV-Zeilen:** Umsatzerlöse, Materialaufwand, Qualitätskosten, Logistikkosten, sonstige betriebliche Aufwendungen, Vorräte (für Cash).
- **Hebel-Vorlagen** als versionierte Regeln in `packages/shared/levers.ts`. Gerechnet wird in SQL.

| Hebel | Rechenregel | Wirkungsart (Standard) |
|---|---|---|
| Preis | (Preis alt − Preis neu) × Menge | EBIT |
| Kostenvermeidung | (angefragter Preis − vereinbarter Preis) × Menge | Kostenvermeidung |
| Qualität | (Fehlerteile vorher − nachher) × Kosten je Fehlerteil | EBIT |
| Logistik | (Kosten je Einheit vorher − nachher) × Menge | EBIT |
| Working Capital | Bestandsreduktion in Euro | Cash |
| Innovation | Zusatzumsatz × Deckungsbeitragsquote | EBIT oder strategisch |
| Risiko | vermiedener Schaden × Eintrittswahrscheinlichkeit | strategisch |

## Ablauf

1. Auf der Initiative-Seite steht die Kachel **Wirkung**:
   - ohne Wirkung der Knopf **Wirkung einrichten**
   - mit Wirkung Betrag, Wirkungsart und Reifegrad als Kennzahl mit Verweis
2. **Wirkung einrichten** (`/lieferanten/<id>/wirkung/<initiative>/einrichten`):
   - Hebel wählen, mit Erklärung der Rechenregel
   - GuV-Zeile wählen
   - Wirkungsart prüfen und bei Bedarf ändern, nur erlaubte Arten
3. **Lieferant › Wirkung** (`/lieferanten/<id>/wirkung`): Liste der Initiativen mit Hebel, GuV-Zeile, Wirkungsart, Reifegrad und Betrag. Die Beträge kommen ab PNL-05.
4. Der Lieferant schlägt unter Gemeinsamer Plan eine Idee vor, die als Initiative mit Quelle `supplier_idea` entsteht.
5. **Einstellungen › GuV-Zeilen**: Liste, bearbeitet auf eigenen Seiten.

## Umsetzung

- **Abweichung vom Datenmodell:** Hebel, Version der Rechenregel, GuV-Zeile, Wirkungsart und
  Wirkungsbeginn stehen nicht an der geteilten Tabelle `initiative`, sondern käuferprivat in
  `initiative_impact` (Migration 0051). So sieht der Lieferant die GuV-Struktur des Käufers nicht,
  und der Käufer muss keine Zeilen der anderen Seite ändern. `source` steht an `initiative`
  (geteilt); der Reifegrad kommt aus `maturity_step` (PNL-03).
- Die Lieferantenidee entsteht, indem der Lieferant unter Gemeinsamer Plan eine Initiative anlegt;
  sie trägt dann die Quelle `supplier_idea`.
- Die Rechenregeln stehen versioniert in `packages/shared/src/levers.ts` (Eingaben, erlaubte
  Wirkungsarten) und gerechnet in SQL (`app_lever_amount`, ganze Cent, halbe Cent von null weg
  gerundet). `leverVersions` nennt alle Versionen, die SQL weiter rechnen kann.
- Geldeingaben sind ganze Cent; die Oberfläche nimmt Euro wie „12,34“ entgegen.
- Neue Rechte `wirkung.sehen` und `wirkung.bearbeiten`, nur für Käufer.
- Der Betrag an der Initiative folgt mit PNL-05; bis dahin zeigt die Kachel Hebel, Wirkungsart und
  Reifegrad mit Verweis auf die Wirkungs-Seite.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Jede Initiative mit Wirkung hat Quelle, Hebel, GuV-Zeile und Wirkungsart.
- [x] Jede Rechenregel ist mit Beispielwerten getestet, auch für die Rundung auf ganze Cent.
- [x] Eine geänderte Rechenregel erhöht die Version, alte Initiativen rechnen mit ihrer Version weiter.
- [x] Nicht erlaubte Kombinationen von Hebel und Wirkungsart lehnt die API ab.
- [x] Die Initiative zeigt den Betrag nur als Kennzahl mit Verweis.

## Nicht Teil dieser Funktion

- Baseline und Reifegrade (PNL-03)
- Monatswerte (PNL-05)
- Teilungsregel (PNL-07)
