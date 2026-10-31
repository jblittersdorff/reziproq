# NAV-06 Lieferanten-Arbeitsbereich

Release 0.1 · baut auf PLT-03, PLT-05, PLT-11 · deckt ab NAV-06, NAV-07, NAV-08, NAV-09

## Ziel

Als SRO finde ich alles zu einem Lieferanten in einem Arbeitsbereich mit sechs Bereichen. Oben sehe ich auf einen Blick, wo die Beziehung steht, und ob ich gerade Internes oder Geteiltes sehe.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Arbeitsbereich jedes eigenen Lieferanten öffnen. Inhalte je Rolle regeln die einzelnen Specs. |
| Lieferant | Nicht Teil. Seine Variante ohne Strategie kommt mit LIF-02. |

## Daten

- Keine neuen Tabellen.
- **Kennzahl-Quellen:** Jedes Modul meldet für den Überblick genau eine Kennzahl je Lieferant über eine Schnittstelle im Backend (`overviewMetric(relationshipId, user)`). Der Überblick speichert nichts selbst.
- **Kopf:** Er liest Segment Ist → Soll aus SEG-06, den SRO aus PLT-05 und den nächsten Termin aus QBR-01. Fehlt ein Wert, steht „noch offen“, oder die Angabe entfällt.

## Ablauf

1. **Adressen:**
   - `/lieferanten/<id>` ist der Überblick.
   - `/lieferanten/<id>/strategie`, `/beziehung`, `/plan`, `/umsetzung` und `/wirkung` sind die Bereiche, jeder mit eigenen Unterseiten.
2. **Lokale Leiste** unter der globalen Leiste, wie die Produktleiste auf apple.com:
   - links der Name
   - Mitte Überblick, Strategie, Beziehung, Gemeinsamer Plan, Umsetzung, Wirkung
   - rechts Platz für den Knopf **Nächster Schritt** (füllt ZYK-01)
   - Sie bleibt beim Scrollen oben stehen.
3. **Bereichsseite:** Jeder Bereich zeigt seine Unterseiten als große Kacheln, z. B. Strategie mit Segmentierung, Lieferantenplan, Spend sowie Profil und Finanzen. Es gibt keine zweite Menüzeile.
4. **Kopf:**
   - Inhalt: Segment Ist → Soll, SRO, nächster Termin
   - auf dem Überblick groß und zentriert, auf allen anderen Seiten als schmale Zeile unter der lokalen Leiste
   - Der Name steht nur in der lokalen Leiste.
5. **Überblick:**
   - Kopf
   - Platz für die Zyklus-Leiste (ZYK-01)
   - sechs Kacheln: Strategie, Beziehung, Gemeinsamer Plan, Umsetzung, Wirkung, Hinweise
   - Jede Kachel zeigt Titel, einen Satz, eine Kennzahl und den Knopf **Öffnen**.
   - Fehlt das Modul noch, steht dort „Kommt mit Release 0.x“.
6. **Kennzeichen Intern und Geteilt (NAV-09):**
   - Der Bereich Strategie trägt durchgehend „Intern“.
   - In den anderen Bereichen trägt jedes Objekt sein Kennzeichen.
   - Symbol und Text kommen aus dem Styleguide.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Alle sechs Bereiche haben eigene Adressen. Der aktive ist markiert, und der Wechsel lädt die Seite nicht neu.
- [ ] Die lokale Leiste bleibt beim Scrollen sichtbar.
- [ ] Jede Bereichsseite zeigt ihre Unterseiten als Kacheln. Höchstens sechs je Seite.
- [ ] Der Kopf zeigt die Werte aus ihrem Ort. Ein Test ändert den SRO im Team und prüft den Kopf.
- [ ] Der Überblick speichert keine eigenen Daten. Ohne Modul zeigt die Kachel den Release-Hinweis.
- [ ] Jede Seite im Bereich Strategie trägt das Kennzeichen „Intern“.
- [ ] Die Seiten aus PLT-03 und PLT-05 (Profil, Spend, Team) liegen im Arbeitsbereich und haben einen Pfad mit Zurück.
- [ ] Bei 390 px Breite bricht die lokale Leiste ohne waagerechtes Scrollen um.

## Nicht Teil dieser Funktion

- Zyklus-Leiste und Knopf Nächster Schritt (ZYK-01)
- Inhalte der Bereiche (eigene Specs)
- Arbeitsbereich des Lieferanten (LIF-02)
