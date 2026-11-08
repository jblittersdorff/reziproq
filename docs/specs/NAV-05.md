# NAV-05 Start

Release 0.1 · baut auf PLT-11, NAV-06, SEG-04 · deckt ab NAV-05

## Ziel

Als Nutzer sehe ich nach dem Login, was ich heute tun muss, und komme mit einem Klick dorthin.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Die eigene Startseite sehen. Sie zeigt nur, was der Nutzer sehen darf. |
| Lieferant | Bekommt mit LIF-02 eine eigene Startseite nach demselben Muster. |

## Daten

- Keine neuen Tabellen. Start speichert nichts.
- **Aufgaben-Quellen:** Jedes Modul meldet über eine Schnittstelle im Backend (`dueItems(user)`) seine offenen Aufgaben für den Nutzer, mit Titel, Lieferant, Frist und Link.
  - Ab sofort meldet SEG-04 seine Bewertungen.
  - Spätere Specs melden ihre Aufgaben, z. B. Beiträge, Maßnahmen, Zusagen und Freigaben.
- **Termin-Quelle:** liefert die nächsten Termine (ab QBR-01).
- **Hinweis-Quelle:** liefert die Hinweise (ab FS-01).

## Ablauf

1. Oben steht eine Begrüßung nach Tageszeit mit Vornamen.
2. Darunter ein großes Eingabefeld **Frag Reziproq**. Enter führt zu `/fragen?q=…` (PLT-12). Bis PLT-12 ist das Feld nicht da.
3. Darunter vier große Kacheln, jede mit höchstens fünf Einträgen und einem Knopf **Alle**:

   | Kachel | Inhalt | Alle führt zu |
   |---|---|---|
   | Fällig bei mir | Titel, Lieferant, Frist, nach Frist sortiert | `/start/faellig` |
   | Nächste Termine | Datum, Art, Lieferant | `/start/termine` |
   | Hinweise | Titel, Lieferant | `/hinweise` |
   | Meine Beziehungen | Lieferanten, in deren Team ich bin, mit Soll-Typ | `/lieferanten?meine=1` |

4. Jeder Eintrag führt direkt zum Ort der Information, z. B. zur Bewertung. Auf Start lässt sich nichts bearbeiten.
5. Kacheln ohne Quelle zeigen „Kommt mit Release 0.x“. Kacheln ohne Einträge zeigen einen freundlichen leeren Zustand, z. B. „Nichts fällig.“

## Fertig, wenn

Je Kriterium ein Test.

- [x] Eine offene Bewertung erscheint unter „Fällig bei mir“ und führt zur Bewertung. Nach der Abgabe verschwindet sie.
- [x] Jede Kachel zeigt höchstens fünf Einträge. **Alle** führt zur vollständigen Liste.
- [x] Start und `/start/faellig` speichern nichts. Ein Test prüft, dass keine Tabelle dafür existiert.
- [x] Ein Nutzer sieht nur Aufgaben, die ihm gehören, und nur Lieferanten, die er sehen darf.
- [x] Die Kacheln stehen auf breiten Bildschirmen zu zweit nebeneinander, auf schmalen untereinander.
- [ ] Die Seite lädt bei 50 Lieferanten in unter zwei Sekunden (lokale Messung).

## Nicht Teil dieser Funktion

- Termine (QBR-01) und Hinweise (FS-01) als Quellen
- Fragen-Seite (PLT-12)
- Startseite des Lieferanten (LIF-02)
