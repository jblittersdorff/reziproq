# ZYK-01 Zyklus und Zyklus-Leiste

Release 0.2 · baut auf SEG-02, NAV-06 · deckt ab ZYK-01, ZYK-03

## Ziel

Als SRO sehe ich für jeden Fokuslieferanten, wo der Jahreszyklus steht und was als Nächstes zu tun ist. Ein Klick bringt mich dorthin.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle mit Zugriff | Zyklus-Leiste und nächsten Schritt sehen. |
| SRO, Admin | Zyklus starten und den Termin des Joint Business Planning setzen (ZYK-02). |
| Lieferant | Sieht die Zyklus-Leiste nicht. Er sieht nur gemeinsame Termine. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `cycle` | `id`, `relationship_id`, `label` (z. B. „2027“), `started_at`, `jbp_date` (optional), `status` (`active`, `closed`) | `buyer_private` |

**Die sieben Schritte und wann sie erledigt sind:**

| Schritt | Erledigt, wenn |
|---|---|
| Segment | Es gibt eine Konsolidierung (SEG-06) seit Zyklusstart oder aus den letzten zwölf Monaten. |
| Feedback | Eine Feedback-Welle ist im Zyklus aufgedeckt (PUL-03). |
| Kontaktpunkte | Die Kontaktpunkte sind im Zyklus geprüft (PLB-06). |
| Lieferantenplan | Eine Version ist im Zyklus freigegeben (SPL-07). |
| JBP | Der Gemeinsame Plan ist von beiden freigegeben (JBP-06). |
| Scorecard | Beide Seiten haben unterschrieben (JBP-07). |
| Umsetzung | Läuft ab dann bis zum Zyklusende. |

- **Status ableiten, nicht speichern:** Jedes Modul meldet seinen Schritt über eine Schnittstelle (`cycleStepStatus(cycle)`). Erlaubte Werte: offen, läuft, erledigt, überfällig. Der Zyklus speichert keinen Status je Schritt.
- Schritte, deren Modul noch fehlt, zeigen „noch nicht verfügbar“.
- Setzt ein Admin einen Lieferanten auf Fokus (SEG-02), entsteht automatisch ein aktiver Zyklus.

## Ablauf

1. **Überblick des Lieferanten:** Unter dem Kopf steht die Zyklus-Leiste. Sie zeigt sieben Punkte mit Namen und Status, der aktuelle Schritt ist hervorgehoben. Ein Klick auf einen Punkt öffnet die Seite des Schritts.
2. **Nächster Schritt** in der lokalen Leiste:
   - Er nennt den ersten offenen Schritt, z. B. „Lieferantenplan freigeben“, und seine Fälligkeit.
   - Ein Klick führt direkt dorthin.
   - Ohne aktiven Zyklus ist der Knopf nicht da.
3. Ohne Zyklus zeigt der Überblick eines Fokuslieferanten **Zyklus starten**. Andere Lieferanten zeigen keine Leiste.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Fokus setzen erzeugt genau einen aktiven Zyklus.
- [ ] Jeder Schritt leitet seinen Status aus dem Modul ab. Ein Test schließt den Schritt Segment über eine Konsolidierung ab und prüft die Leiste.
- [ ] Der Knopf Nächster Schritt zeigt immer den ersten offenen Schritt und führt zur richtigen Seite.
- [ ] Schritte ohne Modul zeigen „noch nicht verfügbar“ statt eines falschen Status.
- [ ] Der Test-Lieferant sieht keinen Zyklus (PLT-04).

## Nicht Teil dieser Funktion

- Fälligkeiten und Erinnerungen (ZYK-02)
- Stand der Zyklen im Portfolio (ZYK-04)
- Neuer Zyklus nach einem Jahr (ZYK-05)
