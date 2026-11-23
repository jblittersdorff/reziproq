# NAV-10 Navigation: Übersicht, Mein Tag, Lieferanten, Warengruppen

Release 1.1 · baut auf NAV-05 (Start), LS-01, FS-01, Impact-Ledger, WG-01 bis WG-20 · deckt ab NAV-10 bis NAV-14 · ersetzt die Hauptnavigation Start, Warengruppen, Lieferanten, Portfolio, Wirkung, Agenten · **ersetzt Version 1.0 (Kopfzeile mit Pillen)**

Änderungen gegenüber 1.0:
- Die Kopfzeile entfällt. Auf dem Desktop gibt es eine Seitenleiste, auf dem Telefon eine Tab-Leiste unten.
- Jede Seite folgt den fünf Seitenregeln (Abschnitt „Seitenregeln“).
- Die Übersicht und Mein Tag sind kürzer. Lieferanten- und Warengruppenkopf sind neu gestaltet.
- Die Warengruppe bekommt eine eigene Seite „Überblick“.

Hinweis: Alles zu Claims, Risiken und Verträgen in dieser Spec erscheint nur, wenn das Modul in `org_module` aktiv ist (siehe UX-20). In Release 1.1 sind diese Module aus.

## Ziel

Der Nutzer weiß auf jeder Seite drei Dinge, ohne zu suchen:
1. wo er ist;
2. wo er im Prozess steht;
3. was als Nächstes zu tun ist, mit einem Klick erreichbar.

Alles andere tritt zurück. Reziproq wird auch vom Telefon aus genutzt. Jede Seite wird zuerst für 390 px Breite gebaut und dann für den Desktop erweitert.

Reziproq hat vier Hauptpunkte. Jeder beantwortet eine Frage:

| Hauptpunkt | Frage |
|---|---|
| **Übersicht** | Was haben wir erreicht? |
| **Mein Tag** | Was mache ich heute? |
| **Lieferanten** | Wie steht es um Lieferant X? |
| **Warengruppen** | Steht meine Strategie? |

KI ist kein Menüpunkt. Reziproq erscheint als Akteur in den Aktivitäten, als Absender von Entwürfen und im Feld „Suchen oder fragen“. Agenten verwalten liegt in den Einstellungen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle mit Zugriff | Alle vier Hauptpunkte. Jede Zahl und jede Zeile zeigt nur Lieferanten und Warengruppen, die die Person sehen darf. |
| Lead, Admin | Starten standardmäßig in der Übersicht. |
| Alle anderen Käufer | Starten standardmäßig in Mein Tag. |
| Jede Person | Die eigene Startseite in den Einstellungen ändern. |
| Lieferant | Eigene Navigation mit denselben Bausteinen: Start, Kunden. Sieht nichts von der Käuferseite. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `user_setting` (besteht) | neuer Schlüssel: `start_page` (`overview`, `my_day`), leer = nach Rolle | `org_private` |
| `note` | `id`, `org_id`, `relationship_id`, `author_user_id`, `visibility` (`team`, `private`), `kind` (`note`, `call`), `text`, `pinned`, `created_at`, `updated_at` | `org_private` |
| `activity_feed` (Sicht, keine Tabelle) | `org_id`, `relationship_id`, `occurred_at`, `kind` (`meeting`, `note`, `call`, `mail`, `transcript`, `document`, `hint`, `agent`), `actor` (Person oder `reziproq`), `title`, `meta`, `object_type`, `object_id`, `visibility` | aus den Quelltabellen |
| `timeline_item` (Sicht, keine Tabelle) | `org_id`, `date`, `kind` (`meeting`, `deadline`, `approval`, `commitment`, `risk`), `title`, `meta`, `object_type`, `object_id`, `relationship_id`, `category_id` | aus Terminen, Claims, Warengruppen, Zusagen, Bewertungsrunden, Krisen |
| `next_action` (Sicht, keine Tabelle) | `org_id`, `user_id`, `scope` (`global`, `relationship`, `category`, `page`), `scope_id`, `kind`, `title`, `kicker`, `due_at`, `href`, `score` | aus Aufgaben, Hinweisen, Zusagen, Abläufen |

- `activity_feed` ist eine SQL-Sicht über Termine, `note`, Dokumente, Hinweise (FS-01, KI-16) und abgeschlossene Läufe von Agenten mit Entwürfen (`agent_run` aus KI-04). Mails und Transkripte kommen mit den Anbindungen (IN-04, IN-05) dazu. Die Zeilensicherheit der Quelltabellen gilt weiter.
- Eine Notiz mit `private` sieht nur die Person, die sie geschrieben hat, auch kein Admin.
- `next_action` liefert je Ort genau einen nächsten Schritt (siehe Seitenregel 3). Die Auswahl trifft der Code nach `score`:
  - überfällig vor fällig heute;
  - dann Wirkung (Spend × Segment);
  - dann Frist.
- Ohne Kandidat liefert die Sicht nichts, und die Seite zeigt keine Karte „Als Nächstes“.

Adressen und Weiterleitungen:

| Neu | Alt, leitet weiter |
|---|---|
| `/uebersicht` | `/wirkung` |
| `/mein-tag` | `/start` |
| `/lieferanten` (Ansichten Liste, Matrix, Bewertungsrunde) | `/portfolio` → `/lieferanten?ansicht=matrix` |
| `/warengruppen` | unverändert |
| `/warengruppen/<id>` | bisher Schritt 10, jetzt Überblick; Schritt 10 unter `/warengruppen/<id>/strategie/freigabe` |
| `/einstellungen/ki/agenten` | `/agenten` |
| `/` | Startseite der Person |

Lieferant (`/lieferanten/<id>/…`):

| Bereich | Seiten | Alt |
|---|---|---|
| Überblick | – | Überblick |
| Aktivitäten | Verlauf, Termine | Termine aus Umsetzung |
| Plan | Vorbereitung, Themen, Initiativen, Zusagen, Maßnahmen, Scorecard, Freigabe | Gemeinsamer Plan, Maßnahmen aus Umsetzung |
| Ergebnisse | Gesichert, Wertpotenziale, Feedback | Wirkung, Wertpotenziale aus Gemeinsamer Plan, Feedback aus Beziehung |
| Profil (Knopf „···“ im Kopf) | Profil und Spend, Segmentierung, Warengruppen, Lieferantenplan, Team, Spielregeln, Beziehungsnetz | Strategie, Team und Spielregeln aus Beziehung |

Warengruppe (`/warengruppen/<id>/…`):

| Bereich | Inhalt | Alt |
|---|---|---|
| Überblick | **neu:** vier Phasen, „Als Nächstes“, Zeilen zu Analysen, Lieferanten, Zielen, Strategie | bisher Schritt 10 |
| Strategie | der geführte Ablauf in zehn Schritten, darin Schritt 10 Zusammenfassung und Freigabe (WG-16) | unverändert |
| Lieferanten | Supplier Map (WG-15) | Schritt 9 |
| Ergebnisse | Scorecard und Ziele der Warengruppe (WG-12) | Schritt 7 |

Alte Adressen leiten auf die neuen weiter. Lesezeichen und Links in Mails funktionieren weiter.

## Seitenregeln

Jede Seite der Käufer- und Lieferantenseite folgt diesen fünf Regeln:

1. **Wo bin ich.**
   - Großer Titel (Outfit 700, 34 bis 36 px, auf dem Telefon 30 px).
   - Darüber ein Zurück-Link mit dem Namen der Ebene darüber, zum Beispiel „‹ Lieferanten“ oder „‹ Warengruppen“. Die Startseiten der vier Hauptpunkte haben keinen Zurück-Link.
   - Der Hauptpunkt ist in Seitenleiste oder Tab-Leiste markiert.
2. **Wo stehe ich im Prozess.**
   - Wo ein Ablauf läuft, steht unter dem Titel eine Schrittfolge.
   - Im Überblick hat sie vier Phasen (Lieferant: Segment, Plan, JBP, Ergebnisse; Warengruppe: Analyse, Bewertung, Strategie, Freigabe).
   - In einem Ablauf zeigt sie alle Schritte (Ablauf-Leiste).
3. **Genau eine Karte „Als Nächstes“.**
   - Dunkle Tinte-Karte mit Kurzzeile (Mint), Titel und genau einem Knopf.
   - Sie steht direkt unter dem Kopf.
   - Auf dem Telefon füllt der Knopf die Breite. In Prozessschritten steht er unten fest über der Tab-Leiste.
   - Jeder andere Knopf der Seite ist ein Zweitknopf (grau gefüllt).
   - Formulare haben keine Karte, ihr Speichern-Knopf ist der Hauptknopf.
4. **Alles andere tritt zurück.**
   - Inhalte stehen in weißen Gruppen mit Zeilen.
   - Hintergrund und Hilfen sind eingeklappt und öffnen mit einem Klick: Leitfragen, „So liest du …“, Herleitung, Verlauf, Protokoll, „Wer sieht was“, Verbrauch.
   - Zahlen beschränken sich auf die, die die nächste Entscheidung braucht.
5. **Mobil zuerst.**
   - Unter 760 px Breite verschwindet die Seitenleiste. Die Tab-Leiste unten zeigt fünf Ziele: Übersicht, Mein Tag, Lieferanten, Warengruppen, Frag.
   - Spalten stehen untereinander, Tabellen scrollen in ihrem Rahmen, die Seite selbst nie seitwärts.
   - Bedienflächen sind mindestens 44 px hoch.

## Ablauf

1. **Seitenleiste** (ab 761 px Breite):
   - 236 px breit, Fläche `#eceeea`, nicht fixiert, so hoch wie die Seite.
   - Von oben:
     - Logo (führt zur eigenen Startseite);
     - Feld „Suchen oder fragen“ mit ⌘K;
     - die vier Hauptpunkte mit Symbol (Mein Tag mit Zahl offener Dinge für heute);
     - Abstand;
     - Einstellungen;
     - die Person mit Initialen.
   - Der aktive Punkt ist weiß mit leichtem Schatten, sein Symbol Petrol.
   - Auf der Lieferantenseite: Start, Kunden und die Person mit Firma.
2. **Tab-Leiste** (bis 760 px Breite):
   - Fest unten, weiß durchscheinend mit Unschärfe.
   - Fünf Ziele mit Symbol und Text 11 px. Aktiv in Petrol.
   - „Frag“ öffnet Suchen oder fragen als Vollbild.
   - Der Inhalt hat unten 92 px Abstand.
3. **Suchen oder fragen:** ein Feld für beides.
   - **Suchen:** Treffer zu Lieferanten, Warengruppen, Terminen und Notizen erscheinen sofort.
   - **Fragen:** Eine Frage („Warum …“, „Was …“) geht an die bestehende Funktion Fragen, mit dem aktuellen Objekt als Kontext.
   - Antworten sind Entwürfe mit Quellen (KI-03).
4. **Übersicht** (`/uebersicht`): ein Lagebild über alle Bereiche, nicht nur eine Zahl. Breite bis 1200 px, auf dem Telefon alles untereinander. Von oben:
   - Titel „Übersicht“, darunter Organisation, Jahr und Stand. Rechts der Zeitraum als Segment-Umschalter: Quartal, Jahr, Seit Start.
   - **Erste Reihe, zwei Spalten:**
     - links **Ergebnisse:**
       - ein Ring, nur EBIT gesichert gegen das Jahresziel und nur vom Controlling bestätigt;
       - daneben Zahl, Ziel und was fehlt;
       - darunter Säulen „EBIT gesichert je Quartal“.
       - Ohne Jahresziel kein Ring.
       - Cash wird getrennt gezählt und nie addiert.
     - rechts oben **Als Nächstes** (`next_action`, `scope` = `global`): die Handlung mit dem größten offenen Potenzial hinter einem Hindernis.
     - rechts darunter **Zusammengefasst von Reziproq:**
       - ein Satz mit der wichtigsten Zahl, etwa „69 % des Jahresziels sind gesichert. Guss trägt, Leiterplatten wartet auf die Freigabe.“;
       - darunter höchstens drei Punkte mit Status-Chip „Läuft“ (gut), „Hakt“ (kritisch) und „Offen“ (Achtung), je ein Satz mit Zahl;
       - unten die Quellen.
       - Kandidaten je Chip wählt der Code:
         - Läuft: höchster Anteil am Ziel;
         - Hakt: aktive Krise oder Hinweis mit höchstem `score`;
         - Offen: älteste Frist.
     - Auf dem Telefon steht „Als Nächstes“ zuerst, dann die Zusammenfassung, dann Ergebnisse.
   - **Terminschiene „Die nächsten vier Wochen“:**
     - alle Termine, Fristen, Freigaben, Zusagen und Risikodaten über alle Lieferanten und Warengruppen, die die Person sehen darf;
     - waagerecht als Datumskreise auf einer Linie, beginnend mit „Heute“ (Tinte);
     - je Eintrag: Art in Farbe und Text (Termin, Frist, Freigabe, Zusage, Risiko), Titel, eine Unterzeile;
     - höchstens acht Einträge, sortiert nach Datum. Ein Klick öffnet das Objekt.
     - Auf dem Telefon scrollt die Schiene seitwärts in ihrem Rahmen.
     - Quelle: neue Sicht `timeline_item` (`org_id`, `date`, `kind`, `title`, `meta`, `object_type`, `object_id`) über Termine, Claims (Antwortfrist), Freigabetermine der Warengruppen, Zusagen, Bewertungsrunden und aktive Krisen.
   - **Lagebild, vier Diagrammkarten** im Raster (zwei Spalten, auf dem Telefon eine):
     - **Warengruppen:** EBIT gesichert gegen Ziel je Warengruppe als Ziel-Balken. Potenzial aus nicht freigegebenen Strategien wird hell dargestellt.
     - **Lieferanten:** Spend nach Segment als sortierte Balken; Link „n Lieferanten brauchen dich“.
     - **Risiko:** hohe Risiken mit und ohne Maßnahme als 100-%-Balken. Bei aktiver Krise eine Zeile dazu.
     - **Claims:** gefordert gegen berechtigt als Balken, dazu Chips „n offen“ und „n älter als 60 Tage“.
     - Jede Karte hat ein Bereichslabel, eine Aussage mit Zahl als Titel, das Diagramm, eine Quellzeile und unten genau einen Link in den Bereich.
     - Eine Karte erscheint nur, wenn der Bereich Daten hat (etwa keine Claims-Karte ohne Claims-Modul).
   - Die Kandidaten und alle Zahlen kommen aus dem Code. Reziproq formuliert nur die Titelsätze aus diesen Fakten. Ein Satz mit einer Zahl, die nicht in den Fakten steht, wird nicht angezeigt, und es erscheint der neutrale Titel des Bereichs.
   - EBIT und Cash werden nie addiert.
   - **Jahresziel:** `org_setting` `goal_ebit_year_cents` je Jahr, Ziele je Warengruppe aus WG-06.
5. **Mein Tag** (`/mein-tag`, ersetzt NAV-05). Auf dem Desktop zwei Spalten (etwa 1,7 : 1, bis 1200 px), auf dem Telefon untereinander.
   - **Kopf:** Titel, Wochentag und Datum mit Begrüßung; rechts „n von m für heute erledigt“ mit Fortschrittsbalken.
   - **Linke Spalte:**
     - **Als Nächstes:** das dringendste Ding für heute, überfällig vor fällig heute, mit Zeitbedarf in der Kurzzeile.
     - **Heute:** die übrigen Dinge mit Fälligkeit heute oder überfällig.
     - **Von Reziproq vorbereitet:** offene Entwürfe der Person, höchstens fünf, Absender-Monogramm „RZ“ in Tinte (Briefings, Import-Prüfung, neue Wertpotenziale, Analysen zur Bestätigung).
     - **Diese Woche:** Aufgaben bis Sonntag mit Wochentag und Datum als Chip.
     - unten der Link „Alle n Aufgaben“.
   - **Rechte Spalte:**
     - **Termine und Fristen** der nächsten 14 Tage aus `timeline_item`, mit Datumskreis und Art als Chip (Frist, Briefing, Freigabe);
     - **Wartet auf andere:** Zusagen, Beiträge und Maßnahmen anderer Personen mit Fälligkeit, überfällig rot;
     - zwei Zeilen „Neu eingegangen“ (Aktivitäten zur Zuordnung) und „Hinweise“.
   - Auf dem Telefon kommt die rechte Spalte nach „Heute“.
6. **Lieferanten** (`/lieferanten`):
   - Titel, Suche und ein Umschalter: Meine, Strategisch, Alle.
   - Gruppen „Brauchen dich“ und „Laufen gut“. Jede Zeile hat Monogramm, Ampelpunkt mit Text und den Grund in einer Zeile.
   - Auf dem Desktop bleibt die Liste mit Detailleiste (LS-01).
   - Matrix und Bewertungsrunde sind Ansichten.
7. **Lieferant: Kopf** (Baustein `SupplierBar`):
   - Zurück-Link „‹ Lieferanten“;
   - Name groß;
   - darunter eine graue Zeile mit Segment, Warengruppe und Schritt im Jahreszyklus;
   - rechts der runde Knopf „···“ für Profil;
   - darunter die vier Bereiche als Segment-Umschalter;
   - die Unterseiten eines Bereichs als schlichte Links, die aktive Seite dunkel.
8. **Lieferant: Überblick**, zwei Spalten:
   - oben die Schrittfolge mit vier Phasen;
   - links:
     - Als Nächstes (`scope` = `relationship`);
     - Zeilen Ergebnisse, Aktivitäten, Gemeinsamer Plan, Beziehungsnetz, Claims und Risiken, je mit Stand-Chip;
     - Diagrammkarte Leistung aus der Scorecard;
   - rechts:
     - Kennzahlen (Spend mit Veränderung, Anteil an der Warengruppe, größte Feedback-Lücke);
     - Termine und Fristen dieses Lieferanten;
     - wichtigste Kontakte mit Stärke der Verbindung und Lücken zu Entscheidern.
9. **Lieferant: Aktivitäten, Verlauf:**
   - oben eine neue Notiz mit Sichtbarkeit Team oder Nur ich;
   - dann Filter: Alles, Termine, Notizen, Mails, Transkripte, Dateien, Reziproq;
   - dann der Verlauf nach Monaten, angeheftete Einträge oben.
   - Kontakte und „Daraus entstanden“ stehen rechts, auf dem Telefon darunter.
   - Der Lieferant sieht die Aktivitäten nie.
10. **Warengruppen** (`/warengruppen`):
    - Titel mit Zahl der Warengruppen, Spend und Stand gegen Ziel; Suche.
    - Links:
      - Als Nächstes (`scope` = `global`, nur Warengruppen);
      - Gruppen „Brauchen dich“, „Freigegeben“, „Noch nicht begonnen“.
      - Auf dem Desktop je Zeile die Spalten Warengruppe (mit Ampelpunkt und Stand), Lead, Spend, Strategie (Schritt mit Balken), Ergebnis gegen Ziel (Balken, Potenzial hell). Auf dem Telefon nur Name, Stand und Ergebnis.
    - Rechts:
      - Diagrammkarte Ergebnisse je Warengruppe;
      - Termine (Freigaben, Reviews);
      - Zeile „Strategie von Reziproq entwerfen lassen“ für eine nicht begonnene Warengruppe.
11. **Warengruppe: Kopf** (Baustein `GroupBar`):
    - Zurück-Link „‹ Warengruppen“;
    - Name groß;
    - graue Zeile mit Spend, Zahl der Lieferanten, Lead und Schritt;
    - die vier Bereiche als Segment-Umschalter.
12. **Warengruppe: Überblick** (neu), zwei Spalten:
    - oben die Schrittfolge mit vier Phasen;
    - links:
      - Als Nächstes (`scope` = `category`, der aktuelle Schritt des Ablaufs);
      - Gruppe „Strategie“ mit Analysen, Ziele, Bewertung, Umsetzungsschritten und Freigabe, je mit Stand-Chip (fertig, jetzt, offen);
      - Diagrammkarte Umsatzanteile der Lieferanten mit Link zur Supplier Map;
    - rechts:
      - Kennzahlen (Spend mit Prognose, gesichert gegen Ziel, Potenzial nach Freigabe);
      - Team mit Rollen;
      - nächste Termine.
13. **Abläufe** (JBP, Warengruppe, Claim):
    - Die Ablauf-Leiste (`Flow`) zeigt Schritt n von m, die Schritte und „Fertig, wenn“.
    - Ihr Weiter-Knopf ist ein Zweitknopf.
    - Die Hauptaktion steht in der Karte „Als Nächstes“ der Seite.
    - Auf Schritten, die erledigt oder noch nicht dran sind, führt diese Karte zum aktuellen Schritt.
14. **Einstellungen:**
    - Erreichbar über die Seitenleiste unten und auf dem Telefon über die Person in Mein Tag.
    - Darin der Abschnitt **KI** mit Agenten, Einstellungen KI (KI-01) und eigenen Agenten (KI-09).
15. **Begriffe:** „Wirkung“ heißt in der Oberfläche überall „Ergebnisse“, „Notizraum“ heißt „Aktivitäten“. Tabellen und Code dürfen die alten Namen behalten.

Ausnahmen ohne Seitenleiste und Tab-Leiste:
- Präsentationsmodus des JBP (`J-Moderation`, Vollbild);
- Seiten ohne Anmeldung (Anmeldung, Einladung, Umfrage, Abfrage).

Vorlagen in `docs/design/referenz/`:
- Muster mobil: `A-MeinTag`, `A-Uebersicht`, `A-Lieferanten`, `A-Lieferant`, `A-JBP`, `A-Warengruppen`, `A-Warengruppe`;
- Muster Desktop: `A-Lieferant-Desktop`, `A-Warengruppe-Desktop`;
- gebaute Seiten: `Main`, `Uebersicht`, `L-Ueberblick`, `WG-Uebersicht`, `WG-Start`, `Aufgaben`, `WG-Ziele`, `P-Initiative`;
- Bausteine: `SupplierBar`, `GroupBar`, `Flow`.

Regeln zu Farben, Formen und Bausteinen stehen in `docs/design/designsprache.md`.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ab 761 px Breite zeigt jede Käuferseite die Seitenleiste mit genau vier Hauptpunkten in der Reihenfolge Übersicht, Mein Tag, Lieferanten, Warengruppen, darunter Einstellungen.
- [ ] Bis 760 px Breite ist die Seitenleiste verborgen. Die Tab-Leiste zeigt fünf Ziele und verdeckt keinen Inhalt.
- [ ] Bei 390 px Breite ist auf keiner Seite ein waagerechter Bildlauf der Seite möglich. Tabellen dürfen in ihrem Rahmen scrollen.
- [ ] Jede Seite außer den Startseiten der vier Hauptpunkte hat einen Zurück-Link mit dem Namen der Ebene darüber.
- [ ] Jede Seite hat höchstens eine Karte „Als Nächstes“ und außerhalb davon keinen Hauptknopf. Formulare haben genau einen Hauptknopf.
- [ ] Ohne Kandidat in `next_action` erscheint keine Karte, statt einer leeren.
- [ ] Leitfragen, Herleitungen, Verlauf und „Wer sieht was“ sind beim Laden eingeklappt und öffnen mit einem Klick und mit der Tastatur.
- [ ] Ein Lead landet nach der Anmeldung in der Übersicht, ein SRO in Mein Tag. Eine geänderte Startseite gilt ab der nächsten Anmeldung.
- [ ] Jede alte Adresse aus der Tabelle leitet auf die neue weiter. `/warengruppen/<id>` zeigt den Überblick.
- [ ] Die Übersicht zeigt einen Ring nur mit Jahresziel, genau eine Karte „Als Nächstes“, die Terminschiene mit höchstens acht Einträgen und je Bereich mit Daten eine Diagrammkarte. EBIT und Cash werden nie addiert.
- [ ] Die Terminschiene enthält nur Einträge zu Lieferanten und Warengruppen, die die Person sehen darf, und jeder Eintrag öffnet sein Objekt.
- [ ] Ein Satz mit einer Zahl, die nicht in den Fakten steht, wird nicht angezeigt.
- [ ] Ein Käufer ohne Zugriff auf einen Lieferanten sieht ihn in keiner Zahl, keiner Zeile und keiner Karte „Als Nächstes“.
- [ ] Ein Lauf eines Agenten mit Entwürfen erscheint in den Aktivitäten als Eintrag von Reziproq mit Verweis.
- [ ] Eine private Notiz sieht nur ihre Autorin, auch kein Admin.
- [ ] ⌘K öffnet „Suchen oder fragen“ auf jeder Seite, „Frag“ in der Tab-Leiste auf dem Telefon. Eine Frage auf der Seite eines Lieferanten hat diesen als Kontext.
- [ ] Der Lieferantenkopf zeigt vier Bereiche und den Knopf „···“. Jede bisherige Seite ist genau einem Bereich oder dem Profil zugeordnet.
- [ ] Die Seite Agenten ist nur über Einstellungen, KI erreichbar.
- [ ] Der Lieferant sieht weder Übersicht noch Mein Tag noch Aktivitäten. Seine Seiten nutzen dieselben Bausteine mit seiner Navigation.

## Nicht Teil dieser Funktion

- Eigene Startseiten oder Widgets je Person
- Dunkles Thema
- Eigene App für iOS oder Android. Die Weboberfläche ist mobil nutzbar und bei Bedarf als Web-App installierbar.
