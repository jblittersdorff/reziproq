# NAV-12 Filter der Lieferantenliste

> **Stand K2-b.4 (27.11.2026):** Umgesetzt in der Seite Lieferanten (BZ-01): Chips Alle, Meine, Strategisch, Offene Zusagen; unter „Mehr Filter“ Business Unit, Warengruppe mit Untergruppen, Soll-Typ und Segment.
>
> **Status 24.11.2026 (Umbau KI-nativ): abgelöst.** Maßgeblich: BZ-01. Filter-Chips Alle, Meine, Strategisch, Offene Zusagen und „Mehr Filter“; „Strategisch“ heißt Fokuslieferant (E-K0-09). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

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

- [x] Jeder Filter liefert allein und in Kombination die richtigen Lieferanten.
- [x] Die Filter stehen in der Adresse. Ein geteilter Link zeigt dieselbe Auswahl.
- [x] Zurück aus einem Lieferanten erhält die Filter.
- [x] `meine=1` zeigt genau die Beziehungen, in deren Team der Nutzer ist.
- [x] Bei 390 px Breite brechen die Filter um, ohne waagerechtes Scrollen.

## Nicht Teil dieser Funktion

- Gespeicherte Filter
- Volltextsuche über Inhalte (QS-05)
