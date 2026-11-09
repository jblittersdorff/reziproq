# UMB-05 Einfachere Oberfläche

Umbau · baut auf PLT-10, NAV-05, NAV-06 · ändert NAV-05, NAV-06 und NAV-10 · Entscheidung vom 8.11.2026 (Testlauf-Pfad, `docs/umsetzungsplan.md` Abschnitt 8) · Vorlage: Entwürfe „D · Einfacher“ auf der Design-Seite

## Ziel

Als Einkäufer sehe ich nur, was funktioniert, finde bei einem Lieferanten alles auf einer Seite und weiß auf Start sofort, was heute zu tun ist.

## Wer darf was

| Rolle           | Darf                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| Alle wie bisher | Keine neuen Rechte. Was jemand sieht, entscheidet weiter die API über `/me` und `can()`. |

## Daten

- Keine neuen Tabellen.
- Überblick und Start lesen weiter nur über die bestehenden Schnittstellen (`/overview`, `/start`) und speichern nichts.

## Ablauf

1. **Nur Gebautes:**
   - Kacheln, Zeilen und Abschnitte für Module, die es noch nicht gibt, erscheinen nicht mehr.
   - Der Hinweis „Kommt mit Release …“ bzw. „Kommt nach Release …“ entfällt überall.
   - Ein Bereich ohne gebaute Unterseite fehlt in der lokalen Leiste und auf dem Überblick.
2. **Ein Lieferant auf einer Seite** (`/lieferanten/<id>`):
   - **Kopf:** Monogramm, Name groß, darunter der nächste Schritt als Satz. Daneben eine Karte mit Spend, SRO und Segment Ist → Soll.
   - **Abschnitte:** darunter Strategie, Beziehung, Gemeinsamer Plan und Umsetzung, jeweils mit Kennzeichen (NAV-09).
   - **Zeilen:** Jeder Abschnitt ist eine Liste seiner gebauten Unterseiten. Eine Zeile zeigt Titel, Stand und Pfeil und führt zur Unterseite.
   - **Lokale Leiste:** Monogramm und Name, rechts die Abschnitte. Ein Klick springt zum Abschnitt. Auf einer Unterseite ist ihr Bereich markiert.
   - **Bereichsadressen:** `/lieferanten/<id>/strategie` usw. führen zum Abschnitt auf dem Überblick. Die Bereichsseiten mit Kacheln entfallen, ebenso die Kachel „Hinweise“.
   - **Zyklus-Leiste (ZYK-01):** steht weiter unter dem Kopf.
3. **Start als Aufgabenliste** (`/start`):
   - **Titel:** links oben das Datum, darunter die Begrüßung als Titel. Über der Liste steht, wie viel heute ansteht, z. B. „3 Dinge für heute“.
   - **Aufgaben:** darunter die fälligen Aufgaben als Liste. Je Zeile stehen Monogramm, was zu tun ist, Lieferant, Frist und ein Knopf, der zur Sache führt. Die erste Zeile hat den gefüllten Knopf.
   - **Erledigt:** Was am Ort der Sache erledigt ist, verschwindet von selbst.
   - **Meine Lieferanten:** darunter als kleine Karten mit Monogramm und Stand.
   - **Rechte Spalte:** die Portfolio-Zahlen. Der nächste Termin kommt hinzu, sobald QBR-01b die Termin-Quelle liefert.
   - **Lieferantenseite:** Statt der Lieferanten stehen dort die Kunden.
   - **Ohne Aufgaben:** Der leere Zustand sagt, dass heute nichts fällig ist, und führt zu den Lieferanten.
4. **Monogramm:**
   - zwei Buchstaben aus dem Namen ohne Rechtsform und ohne „(Demo)“
   - auf einer ruhigen Fläche, für Fokuslieferanten in Tinte mit Minze
   - dekorativ, der Name steht immer daneben

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Kein Text „Kommt mit Release“ oder „Kommt nach Release“ auf irgendeiner Route (Rundgang wie PLT-09).
- [ ] Der Überblick zeigt die Abschnitte nur mit gebauten Unterseiten. Ein Abschnitt ohne gebaute Unterseite fehlt, auch in der lokalen Leiste.
- [ ] `/lieferanten/<id>/strategie` führt zum Abschnitt Strategie auf dem Überblick.
- [ ] Auf einer Unterseite ist in der lokalen Leiste ihr Bereich markiert.
- [ ] Start zeigt die fälligen Aufgaben als Liste mit genau einem Knopf je Zeile, der zur Sache führt. Ohne Aufgaben erscheint der leere Zustand.
- [ ] Das Monogramm lässt Rechtsform und „(Demo)“ weg (Unit-Test mit „Rheintal Elektronik GmbH (Demo)“ → „RE“).
- [ ] Bei 390 px Breite gibt es auf Start und auf dem Überblick keine waagerechte Scrollleiste.

## Nicht Teil dieser Funktion

- Nächster Termin auf Start (QBR-01b)
- Maßnahmen auf Start und im Abschnitt Umsetzung (QBR-03)
- Tab-Leiste unten auf dem Telefon (später, eigene Spec)
