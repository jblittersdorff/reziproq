# SEG-05 Segmentierung je Lieferant mit Abweichungen

Release 0.1 · baut auf SEG-04, NAV-06 · deckt ab SEG-05, SEG-09

## Ziel

Als SRO sehe ich auf einer Seite, wie meine Organisation einen Lieferanten einordnet: je Business Unit und Warengruppe, Ist und Soll, und wo sich Funktionen oder BUs uneinig sind.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer | Die Seite sehen, mit den Bewertungen, die SEG-04 erlaubt. |
| Lieferant | Nie. Die Seite liegt im Bereich Strategie und ist intern. |

## Daten

- Keine neuen Tabellen.
- **Vorläufige Einordnung** je BU und Warengruppe: Mittelwert aller abgegebenen Bewertungen, daraus der Typ nach SEG-01.
- **Konsolidierte Einordnung:** aus SEG-06. Solange sie fehlt, zeigt die Seite die vorläufige mit dem Hinweis „vorläufig“.
- **Abweichung** je Kriterium: Spannweite zwischen höchstem und niedrigstem Ist-Wert der Bewertenden in derselben BU und Warengruppe bzw. über BUs hinweg.

## Ablauf

1. **Lieferant › Strategie › Segmentierung** (`/lieferanten/<id>/strategie/segmentierung`) zeigt von oben nach unten:
   - **3×3-Matrix:** Punkt für Ist, Pfeil zu Soll, gesamt
   - **Tabelle je BU und Warengruppe:** Ist-Typ, Soll-Typ, Anzahl Bewertungen, vorläufig oder konsolidiert
   - **Abweichungen als Heatmap:**
     - Zeilen sind BU, Warengruppe und Funktion, Spalten die Kriterien.
     - Die Farbe zeigt die Abweichung vom Mittelwert.
     - Die Zeilen mit der größten Abweichung stehen oben.
   - **Verlauf** der Konsolidierungen (ab SEG-06)
   - Knopf **Konsolidieren** für den SRO (ab SEG-06)
2. Ein Klick auf eine Zelle der Heatmap öffnet `/…/segmentierung/kriterium/<key>`. Dort stehen alle Werte und Begründungen zu diesem Kriterium, mit BU und Funktion.
3. Ohne Bewertungen erscheint ein leerer Zustand mit Verweis auf die Bewertungsrunden.
4. Auf dem Überblick (NAV-06) zeigt die Kachel Strategie den Soll-Typ als Kennzahl.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Matrix, Tabelle und Heatmap stimmen mit den Bewertungen in der Datenbank überein.
- [ ] Die größten Abweichungen stehen oben. Ein Klick führt zu den Begründungen.
- [ ] Ein Nutzer der BU A sieht vor der Konsolidierung nur Zeilen der BU A (Regel aus SEG-04).
- [ ] Ohne Konsolidierung steht „vorläufig“ an jedem Typ.
- [ ] Die Diagramme nutzen ECharts mit Diagramm-Tokens und sind mit 10 Bewertenden lesbar.
- [ ] Die Seite trägt das Kennzeichen „Intern“, und der Test-Lieferant bekommt 403.

## Nicht Teil dieser Funktion

- Konsolidierung (SEG-06)
- Portfolio über alle Lieferanten (SEG-07)
- KI-Erklärung der Abweichungen (SEG-11)
