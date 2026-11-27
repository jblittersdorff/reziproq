# SEG-07 Portfolio

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: BZ-01. Die Runde entsteht als Entwurf, Bewertungen kommen in Kurz prüfen, die Konsolidierung wird die Segment-Mappe, das Portfolio die Linse Segmente. Die Regeln gelten wörtlich weiter. Größe der Matrix je Segmentmodell (E-K0-33). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.1 · baut auf SEG-06, PLT-11 · deckt ab SEG-07, SEG-08

## Ziel

Als Leitung des Lieferantenmanagements sehe ich auf einen Blick, wo alle Lieferanten heute stehen und wohin wir sie entwickeln wollen, und wo noch Entscheidungen fehlen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Portfolio sehen, nur mit Lieferanten, die sie sehen dürfen. |
| Lieferant | Nie. |

## Daten

- Keine neuen Tabellen.
- Die Matrix liest die konsolidierten Typen gesamt aus SEG-06. Mit Filter auf BU oder Warengruppe liest sie die passenden Zeilen je BU und Warengruppe.
- Die Punktgröße ist der Spend des letzten vollen Jahres (PLT-03).
- **„Ungeklärte Abweichung“** heißt: Die größte Abweichung eines Kriteriums liegt über einem je Kunde einstellbaren Wert, und nach der Bewertung gab es keine Konsolidierung.

## Ablauf

> **Seit K2-b.5 (27.11.2026):** `/portfolio` leitet auf die Linse Segmente der Seite Lieferanten
> (`/beziehungen?linse=segmente`, BZ-01). Die Kacheln stehen dort als Zeilen „Portfolio im Detail“
> und „Bewertungsrunden“ mit ihrer Kennzahl; die Seiten darunter bleiben, bis K2-e sie ersetzt.

1. **Portfolio** (`/portfolio`) zeigt Kacheln:
   - Matrix
   - Offene Entscheidungen
   - Bewertungsrunden (SEG-03)
   - Fokuslieferanten (SEG-02)
   - Stand der Zyklen (ZYK-04)
   - Jede Kachel zeigt eine Kennzahl.
2. **Matrix** (`/portfolio/matrix`):
   - die 3×3-Matrix mit allen konsolidierten Lieferanten als Punkt, Größe nach Spend
   - ein Pfeil von Ist zu Soll
   - Filter nach BU und Warengruppe, in der Adresse
   - Liegen mehrere Punkte in einer Zelle, verteilen sie sich darin gleichmäßig.
   - Ein Klick auf einen Punkt öffnet die Segmentierungsseite des Lieferanten.
3. **Offene Entscheidungen** (`/portfolio/offen`) zeigt eine Liste, gruppiert nach drei Gründen:
   - Bewertungen noch offen
   - Bewertungen vollständig, aber nicht konsolidiert
   - ungeklärte Abweichung

   Jeder Eintrag führt zum Lieferanten.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Die Matrix ist mit 50 Testlieferanten lesbar, ohne überlappende Beschriftungen.
- [ ] Punktgröße und Typen stimmen mit der Datenbank überein. Die Filter wirken und stehen in der Adresse.
- [ ] Ein Klick auf einen Punkt öffnet die Segmentierungsseite des richtigen Lieferanten.
- [ ] Jede Gruppe der offenen Entscheidungen enthält mit Testdaten den richtigen Lieferanten.
- [ ] Der Schwellwert für Abweichungen ist in den Einstellungen änderbar (Admin).
- [ ] Ein Nutzer sieht nur Lieferanten, die er sehen darf.

## Nicht Teil dieser Funktion

- Fokuslieferanten (SEG-02)
- Stand der Zyklen (ZYK-04)
- Export der Matrix
