# NAV-06 Lieferanten-Arbeitsbereich

> **Status 24.11.2026 (Umbau KI-nativ): abgelöst.** Maßgeblich: AK-01, NAV-10. Der Arbeitsbereich mit Bereichen und Unterseiten wird die Akte mit drei Sichten, Blättern und Mappen. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

> Geändert durch UMB-05 (8.11.2026): ein Lieferant auf einer Seite mit Abschnitten statt Bereichsseiten, nur gebaute Module, kein „Kommt mit Release …“.

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
   - Fehlt das Modul noch, steht dort „Kommt mit Release 1.0“ (Module im Kernpfad) oder „Kommt nach Release 1.0“ (Module aus den Blöcken danach).
6. **Kennzeichen Intern und Geteilt (NAV-09):**
   - Der Bereich Strategie trägt durchgehend „Intern“.
   - In den anderen Bereichen trägt jedes Objekt sein Kennzeichen.
   - Symbol und Text kommen aus dem Styleguide.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Alle sechs Bereiche haben eigene Adressen. Der aktive ist markiert, und der Wechsel lädt die Seite nicht neu.
- [x] Die lokale Leiste bleibt beim Scrollen sichtbar.
- [x] Jede Bereichsseite zeigt ihre Unterseiten als Kacheln. Höchstens sechs je Seite.
- [x] Der Kopf zeigt die Werte aus ihrem Ort. Ein Test ändert den SRO im Team und prüft den Kopf.
- [x] Der Überblick speichert keine eigenen Daten. Ohne Modul zeigt die Kachel den Release-Hinweis.
- [x] Jede Seite im Bereich Strategie trägt das Kennzeichen „Intern“.
- [x] Die Seiten aus PLT-03 und PLT-05 (Profil, Spend, Team) liegen im Arbeitsbereich und haben einen Pfad mit Zurück.
- [x] Bei 390 px Breite bricht die lokale Leiste ohne waagerechtes Scrollen um.

## Umgesetzt mit

- **Kennzahl-Quellen:** Schnittstelle `OverviewMetricSource` mit `overviewMetric(relationshipId, user, tx)` im Modul `overview` der API. Die Quellen trägt `overview.module.ts` ein. Heute melden Spend (Strategie: letztes Jahr mit Daten) und Team (Beziehung: Personen im Team).
- `GET /api/suppliers/:id/overview` liefert Kopf und Kennzahlen, mit `lieferanten.sehen` und ohne neue Aktion. Die Mandanten-Session ist nur lesend (`withTenant(…, { readOnly: true })`), also scheitert jeder Schreibversuch.
- **Kopf:** Segment bleibt „noch offen“ bis SEG-06. Der SRO kommt aus `relationship_member`. Der nächste Termin entfällt bis QBR-01.
- **Bereichsseiten:** Unterseiten, die es noch nicht gibt, zeigen den Release-Hinweis ohne Knopf. Die Hinweise auf dem Überblick haben noch keine Seite und darum keinen Knopf „Öffnen“.
- **Seiten aus PLT-03 und PLT-05:** Profil, Spend und Team heißen jetzt „Profil“, „Spend“ und „Team“. Der Name steht in der lokalen Leiste und im Pfad (Lieferanten › Name › Bereich › Seite). Der Zurück-Pfeil führt eine Ebene nach oben, vom Spend also zur Strategie.
- Die Karten der Lieferantenliste führen auf den Überblick statt auf das Profil.
- Die lokale Leiste liegt in einem Platz des Rahmens direkt unter der globalen Leiste, über die ganze Breite und im Seitenfluss.

## Nicht Teil dieser Funktion

- Zyklus-Leiste und Knopf Nächster Schritt (ZYK-01)
- Inhalte der Bereiche (eigene Specs)
- Arbeitsbereich des Lieferanten (LIF-02)
