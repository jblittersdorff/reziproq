# ZYK-02 Planung rückwärts vom Joint Business Planning

Release 0.2 · baut auf ZYK-01, QS-01 · deckt ab ZYK-02, ZYK-06

## Ziel

Als SRO setze ich nur den Termin des Joint Business Planning. Reziproq rechnet für jeden Schritt davor und danach eine Fälligkeit aus und erinnert die Verantwortlichen rechtzeitig.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Termin setzen und verschieben. |
| Admin | Vorlauf je Schritt für die Organisation einstellen. |
| Käufer: alle mit Zugriff | Fälligkeiten sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `cycle_settings` | `org_id`, `step`, `weeks_relative_to_jbp` (negativ davor, positiv danach), `reminder_days_before` | `org_private` |

**Standardwerte**, je Kunde änderbar:

| Schritt | Fällig |
|---|---|
| Feedback | 8 Wochen vor dem Termin |
| Kontaktpunkte | 6 Wochen vor dem Termin |
| Lieferantenplan | 2 Wochen vor dem Termin |
| JBP | am Termin |
| Scorecard | 3 Wochen nach dem Termin |

Erinnert wird 7 Tage vor der Fälligkeit.

- Fälligkeiten werden berechnet, nicht gespeichert: Termin plus Abstand.
- Erinnerungen laufen als täglicher Job und gehen per Mail über QS-01 an den SRO.
- Ist ein Schritt überfällig, steht er in der Zyklus-Leiste auf „überfällig“ und erscheint auf Start (NAV-05).

## Ablauf

1. Auf dem Überblick klickt der SRO auf **Termin festlegen**. Das öffnet `/lieferanten/<id>/zyklus/termin`, eine Seite mit Datumsfeld und Vorschau aller Fälligkeiten.
2. Die Zyklus-Leiste zeigt unter jedem Schritt seine Fälligkeit.
3. Verschiebt der SRO den Termin, verschieben sich alle Fälligkeiten. Die Seite zeigt vorher die neuen Daten.
4. **Einstellungen › Zyklus** (`/einstellungen/zyklus`): Tabelle der Abstände und Erinnerungstage, bearbeitbar auf eigener Seite.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nach Setzen des Termins stimmen alle Fälligkeiten mit den Abständen überein.
- [ ] Eine Verschiebung verschiebt alle Fälligkeiten, nichts davon ist gespeichert.
- [ ] Sieben Tage vor einer Fälligkeit geht genau eine Erinnerung an den SRO, nur mit Titel und Link.
- [ ] Ein überfälliger Schritt erscheint auf Start und in der Leiste als überfällig.
- [ ] Nur Admins ändern die Abstände.

## Nicht Teil dieser Funktion

- Kalendereinladungen
- Abstände je Lieferant
