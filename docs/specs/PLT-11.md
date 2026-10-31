# PLT-11 App-Rahmen, globale Leiste und Seitenmuster

Release 0.1 · baut auf PLT-10 · deckt ab PLT-11, NAV-01, NAV-02, NAV-03 · überarbeitet am 31.10.2026: Leiste oben statt Seitenleiste, keine Pop-ups

## Ziel

Als Nutzer erreiche ich jeden Hauptbereich mit einem Klick, weiß auf jeder Seite, wo ich bin, und komme immer sauber zurück, ohne dass sich ein Fenster öffnet.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Globale Leiste, Start, Lieferanten, Portfolio, Wirkung, Fragen und Profil sehen. |
| Käufer: Admin | Zusätzlich auf der Profilseite den Weg zu allen Einstellungen. Bis PLT-05 gelten die Rollen aus Zitadel (PLT-01, PLT-02). |
| Käufer: alle Mitglieder einer Organisation | Auf der Profilseite den Weg zu Einstellungen › Organisation, nur lesen (PLT-02). |
| Lieferant | Nicht Teil. Die Navigation für Lieferanten kommt mit LIF-02. |

## Daten

- Keine neuen Fachdaten.
- Liest Name, E-Mail und Organisation aus `/me`.
- Das Erscheinungsbild (System, Hell, Dunkel) wird nur im Browser gespeichert.

## Ablauf

1. Nach dem Login landet der Nutzer auf **Start** (`/start`).
2. **Globale Leiste**, immer oben, wie auf apple.com:
   - links „Reziproq“
   - Mitte Start, Lieferanten, Portfolio, Wirkung
   - rechts die Symbole Fragen und Profil
   - Die aktive Seite ist hervorgehoben.
   - Auf schmalen Bildschirmen klappt die Leiste zu einem Menüknopf ein. Er öffnet eine eigene Menüseite, kein Overlay.
3. **Routen** dieser Spec, jeweils mit Titel und leerem Zustand bis zur Spec, die sie füllt:
   - `/start` (füllt NAV-05)
   - `/lieferanten` (füllt PLT-03)
   - `/portfolio` (füllt SEG-07)
   - `/wirkung` (füllt PNL-10)
   - `/fragen` (füllt PLT-12)
   - `/profil`
   - `/einstellungen`
4. **Profil** (`/profil`) ist eine Seite mit:
   - Name, E-Mail, Organisation
   - Erscheinungsbild
   - Weg zu Einstellungen › Organisation (alle Mitglieder, nur lesen)
   - Weg zu allen Einstellungen (nur Admin)
   - Abmelden
   - für Betreiber der Weg „In einen Kunden wechseln“ (UMB-01)
5. **Pfad und Zurück (NAV-03):**
   - Unter der Leiste steht auf jeder Seite unterhalb der Hauptebene der Pfad mit Zurück-Pfeil, z. B. Einstellungen › Organisation.
   - Der Zurück-Knopf des Browsers macht dasselbe.
   - Speichern und Abbrechen führen zur vorigen Seite.
6. **Seitenmuster (NAV-02):**
   - Jede Ansicht, jedes Formular und jeder Schritt hat eine eigene Adresse.
   - Formulare sind Seiten.
   - Eine unbekannte Adresse zeigt „Diese Seite gibt es nicht“ mit Knopf zu Start.

### Gestaltung

- Leiste schmal und ruhig, Glas-Effekt erlaubt.
- Inhalt mittig mit großzügigem Rand, Bausteine nur aus dem Styleguide.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nach dem Login landet der Nutzer auf `/start`.
- [ ] Jedes Ziel der globalen Leiste ist von jeder Seite mit einem Klick erreichbar. Die aktive Seite ist markiert.
- [ ] Bei 390 px Breite gibt es keine waagerechte Scrollleiste, und das Menü öffnet sich als eigene Seite.
- [ ] Jede Route lässt sich über ihre Adresse direkt öffnen und zeigt Titel und leeren Zustand.
- [ ] Ein Playwright-Test geht drei Ebenen hin und zurück, einmal mit Zurück-Pfeil, einmal mit Browser-Zurück. Er landet immer auf der vorigen Ansicht, auch nach Speichern und Abbrechen.
- [ ] Der Weg zu allen Einstellungen auf `/profil` ist nur für Admins sichtbar. Jedes Mitglied sieht den Weg zu Einstellungen › Organisation.
- [ ] Alles ist per Tastatur bedienbar, mit sichtbarem Fokus.
- [ ] Unbekannte Adressen zeigen die Nicht-gefunden-Seite.
- [ ] Alle Texte stehen in der Übersetzungsdatei.

## Nicht Teil dieser Funktion

- Inhalte von Start (NAV-05), Lieferanten (PLT-03), Portfolio (SEG-07) und Wirkung (PNL-10)
- Lieferanten-Arbeitsbereich mit lokaler Leiste (NAV-06)
- Fragen-Seite mit Inhalt (PLT-12)
- Englische Oberfläche (PLT-09)
