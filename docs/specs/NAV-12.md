# NAV-12 Filter der Lieferantenliste

Release 0.1 · baut auf PLT-03, PLT-06, SEG-06, SEG-02

## Ziel

Als Einkäufer grenze ich die Lieferantenliste mit wenigen Klicks ein, z. B. auf meine Fokuslieferanten einer Warengruppe. Ein Link auf die gefilterte Liste zeigt jedem dasselbe.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Filtern. Die Liste zeigt nur Lieferanten, die der Nutzer sehen darf. |

## Daten

- Keine neuen Tabellen.
- Filter als Parameter in der Adresse, z. B. `/lieferanten?bu=…&wg=…&typ=…&fokus=1&meine=1&beendet=1`.

## Ablauf

1. Über der Liste steht eine Zeile mit Filtern als Auswahllisten bzw. Schaltern:
   - Business Unit
   - Warengruppe (mit Unterebenen)
   - Soll-Typ
   - nur Fokus
   - nur meine Beziehungen (in deren Team ich bin)
   - Beendete zeigen
2. Neben den Filtern steht die Anzahl der Treffer. **Filter zurücksetzen** leert alles.
3. Suche und Sortierung aus PLT-03 wirken zusammen mit den Filtern.
4. Ein Zurück aus einem Lieferanten führt zur Liste mit denselben Filtern.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jeder Filter liefert allein und in Kombination die richtigen Lieferanten.
- [ ] Die Filter stehen in der Adresse. Ein geteilter Link zeigt dieselbe Auswahl.
- [ ] Zurück aus einem Lieferanten erhält die Filter.
- [ ] `meine=1` zeigt genau die Beziehungen, in deren Team der Nutzer ist.
- [ ] Bei 390 px Breite brechen die Filter um, ohne waagerechtes Scrollen.

## Nicht Teil dieser Funktion

- Gespeicherte Filter
- Volltextsuche über Inhalte (QS-05)
