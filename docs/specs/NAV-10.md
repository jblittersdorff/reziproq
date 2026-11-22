# NAV-10 Navigation: Übersicht, Mein Tag, Lieferanten, Warengruppen

Release 1.0 · baut auf NAV-05 (Start), LS-01, FS-01, Impact-Ledger, WG-01 bis WG-20 · deckt ab NAV-10 bis NAV-13 · ersetzt die Hauptnavigation Start, Warengruppen, Lieferanten, Portfolio, Wirkung, Agenten

## Ziel

Reziproq hat vier Hauptpunkte. Jeder beantwortet eine Frage:

| Hauptpunkt | Frage |
|---|---|
| **Übersicht** | Was haben wir erreicht? |
| **Mein Tag** | Was mache ich heute? |
| **Lieferanten** | Wie steht es um Lieferant X? |
| **Warengruppen** | Steht meine Strategie? |

Lieferant und Warengruppe folgen demselben Muster aus Überblick, Arbeit und Ergebnissen. KI ist kein Menüpunkt. Reziproq erscheint als Akteur in den Aktivitäten, im Block „Von Reziproq vorbereitet“ und im Feld „Suchen oder Reziproq fragen“. Agenten verwalten liegt in den Einstellungen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle mit Zugriff | Alle vier Hauptpunkte. Jede Zahl und jede Zeile zeigt nur Lieferanten und Warengruppen, die die Person sehen darf. |
| Lead, Admin | Starten standardmäßig in der Übersicht. |
| Alle anderen Käufer | Starten standardmäßig in Mein Tag. |
| Jede Person | Die eigene Startseite in den Einstellungen ändern. |
| Lieferant | Unverändert: eigene Navigation (Start, Kunden). Sieht nichts davon. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `user_setting` (besteht) | neuer Schlüssel: `start_page` (`overview`, `my_day`), leer = nach Rolle | `org_private` |
| `note` | `id`, `org_id`, `relationship_id`, `author_user_id`, `visibility` (`team`, `private`), `kind` (`note`, `call`), `text`, `pinned`, `created_at`, `updated_at` | `org_private` |
| `activity_feed` (Sicht, keine Tabelle) | `org_id`, `relationship_id`, `occurred_at`, `kind` (`meeting`, `note`, `call`, `mail`, `transcript`, `document`, `hint`, `agent`), `actor` (Person oder `reziproq`), `title`, `meta`, `object_type`, `object_id`, `visibility` | aus den Quelltabellen |

- `activity_feed` ist eine SQL-Sicht über Termine, `note`, Dokumente, Hinweise (FS-01, KI-16) und abgeschlossene Läufe von Agenten mit Entwürfen (`agent_run` aus KI-04). Mails und Transkripte kommen dazu, sobald es die Anbindungen gibt. Die Zeilensicherheit der Quelltabellen gilt weiter.
- Eine Notiz mit `private` sieht nur die Person, die sie geschrieben hat, auch kein Admin.
- Ein Lauf eines Agenten erscheint als Eintrag mit `actor` = `reziproq`: „Reziproq hat <Ergebnis>“, mit Verweis auf Entwürfe und Lauf.

Adressen und Weiterleitungen:

| Neu | Alt, leitet weiter |
|---|---|
| `/uebersicht` | `/wirkung` |
| `/mein-tag` | `/start` |
| `/lieferanten` (Ansichten Liste, Matrix, Bewertungsrunde) | `/portfolio` → `/lieferanten?ansicht=matrix` |
| `/warengruppen` | unverändert |
| `/einstellungen/ki/agenten` | `/agenten` |
| `/` | Startseite der Person |

Lieferant (`/lieferanten/<id>/…`):

| Reiter | Seiten | Alt |
|---|---|---|
| Überblick | – | Überblick |
| Aktivitäten | Verlauf, Termine | Termine aus Umsetzung |
| Plan | Vorbereitung, Themen, Initiativen, Zusagen, Maßnahmen, Scorecard, Freigabe | Gemeinsamer Plan, Maßnahmen aus Umsetzung |
| Ergebnisse | Gesichert, Wertpotenziale, Feedback | Wirkung, Wertpotenziale aus Gemeinsamer Plan, Feedback aus Beziehung |
| Profil (Knopf im Kopf) | Profil und Spend, Segmentierung, Warengruppen, Lieferantenplan, Team, Spielregeln | Strategie, Team und Spielregeln aus Beziehung |

Warengruppe (`/warengruppen/<id>/…`):

| Reiter | Inhalt | Alt |
|---|---|---|
| Überblick | Zusammenfassung und Freigabe (WG-16) | Schritt 10 |
| Strategie | der geführte Ablauf in zehn Schritten | unverändert |
| Lieferanten | Supplier Map (WG-15) | Schritt 9 |
| Ergebnisse | Scorecard und Ziele der Warengruppe (WG-12) | Schritt 7 |

Alte Adressen leiten auf die neuen weiter. Lesezeichen und Links in Mails funktionieren weiter.

## Ablauf

1. **Kopfzeile:**
   - links das Logo, es führt zur eigenen Startseite;
   - in der Mitte die vier Hauptpunkte als Pillen;
   - rechts das Feld **Suchen oder Reziproq fragen** (⌘K oder Strg+K) und der Kreis mit Initialen, der zu Profil und Einstellungen führt.
   - Auf dem Telefon stehen dieselben vier Punkte als Leiste unten. Suchen erreicht man über ein Symbol oben.
2. **Suchen oder Reziproq fragen:** ein Feld für beides.
   - **Suchen:** Treffer zu Lieferanten, Warengruppen, Terminen und Notizen erscheinen sofort.
   - **Fragen:** Eine Frage („Warum …“, „Was …“) geht an die bestehende Funktion Fragen mit dem aktuellen Objekt als Kontext. Auf der Seite von Rheintal sind Fragen auf Rheintal bezogen.
   - Antworten sind Entwürfe mit Quellen (KI-03).
3. **Übersicht** (`/uebersicht`) folgt den drei Schichten der Designsprache: Aussage, Beleg, Daten. Zeitraum wählbar: Quartal, Jahr, seit Start. Von oben:
   - **Aussage:**
     - Ein Satz und zwei bis drei Sätze Erklärung, „Zusammengefasst von Reziproq“, mit Quellen.
     - Der Agent `overview_summary` (KI-04) bekommt nur die Zahlen dieser Seite als Fakten. Jede Zahl im Text muss darin vorkommen, sonst erscheint keine Aussage.
     - Lauf täglich und nach jeder Bestätigung durch das Controlling.
   - **Ringpaar:**
     - außen Ergebnisse, also EBIT gesichert gegen das Jahresziel, nur vom Controlling bestätigt;
     - innen Beziehungen, also Fokuslieferanten mit freigegebenem JBP gegen alle Fokuslieferanten;
     - daneben beide Zahlen mit Ziel und Text.
     - Ohne Jahresziel gibt es keinen äußeren Ring, sondern nur die Zahl und den Hinweis „Ziel festlegen“ für Admins.
   - **Drei Sätze** in drei Karten, je ein Satz mit Zahl und einem Link:
     - **Was gut läuft:** die Warengruppe oder der Lieferant mit dem höchsten Anteil am Ziel.
     - **Was hakt:** das größte offene Potenzial hinter einem Hindernis, etwa einer nicht freigegebenen Strategie oder einem offenen Lieferantenplan; sonst der Hinweis mit dem höchsten `score`.
     - **Was ihr tun solltet:** höchstens zwei Handlungen, abgeleitet aus den beiden anderen Sätzen und den nächsten Fristen; Link zu Mein Tag.
     - Die Kandidaten wählt der Code. Reziproq formuliert die Sätze aus den Fakten mit derselben Prüfung wie die Aussage.
     - Ohne Kandidat fehlt die Karte.
   - Die Aussage oben nennt für Einkäufer und Management dasselbe: Stand gegen Ziel in Prozent und was bis zum Ende des Zeitraums fehlt, dazu ein Satz zum wichtigsten Grund.
   - **Zeilenliste:**
     - In Umsetzung (EBIT-Spanne);
     - Neu gefunden;
     - Cash (getrennt vom EBIT).
     - Jede Zeile führt zur Liste dahinter.
   - **„Mehr wissen? Frag Reziproq“** mit drei vorgeschlagenen Fragen. Weitere Auswertungen, etwa Ergebnisse je Warengruppe oder die Matrix, gibt es nur über diese Fragen oder einen Klick, nicht als weitere Karten.
   - **Jahresziel:** `org_setting` `goal_ebit_year_cents` je Jahr, gepflegt von Admin oder Lead in den Einstellungen. Ziele je Warengruppe kommen aus den Zielen der Strategie (WG-06). Die Summe der Warengruppenziele wird neben dem Jahresziel angezeigt, nicht verrechnet.
4. **Mein Tag** (`/mein-tag`, ersetzt NAV-05), von oben:
   - Begrüßung und Fragefeld;
   - nächster Schritt als Tinte-Karte;
   - **Von Reziproq vorbereitet:** höchstens fünf Einträge, offene Entwürfe der Person nach Lauf gruppiert (Briefings, Ergebnisse nach Terminen, neue Wertpotenziale, Prüfung eines Imports), je mit Prüfen oder Ansehen;
   - **Deine Termine** der nächsten 14 Tage mit Stand des Briefings;
   - **Deine Aufgaben** wie bisher.
   - **rechts:**
     - **Wo du handeln musst** (KI-16);
     - **Neu eingegangen** mit Zahl der Aktivitäten zur Zuordnung. Erscheint erst mit den Anbindungen.
5. **Lieferanten** (`/lieferanten`):
   - Liste mit Detailleiste (LS-01);
   - Ansicht Matrix (bisher Portfolio);
   - Ansicht Bewertungsrunde (bisher im Portfolio).
6. **Lieferant:** Kopf mit Name, Segment, Zyklus und dem Knopf **Profil**; darunter die vier Reiter.
   - **Überblick** zeigt den nächsten Schritt aus dem Jahreszyklus. Der Zyklus steuert nicht die Reiter.
   - **Aktivitäten, Verlauf:**
     - oben eine neue Notiz mit Sichtbarkeit Team oder Nur ich;
     - darunter Frag Reziproq zu diesem Lieferanten;
     - dann Filter: Alles, Termine, Notizen, Mails, Transkripte, Dateien, Reziproq;
     - dann der Verlauf nach Monaten, angeheftete Einträge oben;
     - rechts nächster Termin, Kontakte beim Lieferanten, „Daraus entstanden“ (Zusagen, Maßnahmen, Themen) und der Hinweis, dass der Lieferant die Aktivitäten nie sieht.
7. **Warengruppen:** Liste wie bisher. Die Warengruppe hat den Kopf mit den vier Reitern. Der Ablauf in zehn Schritten bleibt unter Strategie.
8. **Einstellungen:** bekommt den Abschnitt **KI** mit den Seiten Agenten (bisher `/agenten`), Einstellungen KI (KI-01) und eigene Agenten (KI-09).
9. **Begriffe:** „Wirkung“ heißt in der Oberfläche überall „Ergebnisse“, „Notizraum“ heißt „Aktivitäten“. Tabellen und Code dürfen die alten Namen behalten.

Vorlagen in `docs/design/referenz/`: `Header`, `SupplierBar`, `GroupBar`, `Uebersicht`, `Main` (Mein Tag), `L-Notizen` (Aktivitäten), `D-Diagramme` (Formen für alle Auswertungen). Regeln zu Ringen, Diagrammen und Informationsdichte in `docs/design/designsprache.md`.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Die Kopfzeile zeigt genau vier Hauptpunkte in der Reihenfolge Übersicht, Mein Tag, Lieferanten, Warengruppen (`apps/web/src/features/activities/nav-10.test.tsx`, `apps/web/src/features/shell/plt-11.test.tsx`).
- [x] Ein Lead landet nach der Anmeldung in der Übersicht, ein SRO in Mein Tag. Eine geänderte Startseite gilt ab der nächsten Anmeldung (`apps/api/src/modules/activities/nav-10.test.ts`, `apps/web/src/features/shell/plt-11.test.tsx`).
- [ ] Jede alte Adresse aus der Tabelle leitet auf die neue weiter.
- [ ] Gesichert enthält nur vom Controlling bestätigte Ergebnisse. EBIT und Cash stehen getrennt, keine Summe über Wirkungsarten.
- [ ] Die drei Sätze folgen der Regel. Ohne Kandidat fehlt die Karte, statt leer zu erscheinen.
- [ ] Eine Aussage mit einer Zahl, die nicht in den Fakten steht, wird nicht angezeigt.
- [ ] Ohne Jahresziel erscheint kein äußerer Ring.
- [ ] Die Übersicht zeigt eine Aussage, ein Ringpaar, drei Sätze, drei Zeilen und drei Fragevorschläge.
- [ ] Ein Käufer ohne Zugriff auf einen Lieferanten sieht ihn in keiner Zahl, keinem Highlight und keiner Matrix.
- [x] Ein Lauf eines Agenten mit Entwürfen erscheint in den Aktivitäten des Lieferanten als Eintrag von Reziproq mit Verweis (`apps/api/src/modules/activities/nav-10.test.ts`, `apps/web/src/features/activities/nav-10.test.tsx`; bis KI-04 mit den bestehenden Entwürfen aus `ai_draft`, Abnahme mit `agent_run` in Schritt 9 der Warteschlange).
- [x] Eine private Notiz sieht nur ihre Autorin, auch kein Admin (`apps/api/src/modules/activities/nav-10.test.ts`; Zeilensicherheit `note_private_author`).
- [x] ⌘K öffnet das Suchfeld auf jeder Seite. Eine Frage auf der Seite eines Lieferanten hat diesen Lieferanten als Kontext (`apps/api/src/modules/activities/nav-10.test.ts`, `apps/web/src/features/activities/nav-10.test.tsx`, `apps/web/src/features/prompt/plt-12.test.tsx`).
- [x] Die Lieferantenleiste zeigt vier Reiter und den Knopf Profil. Jede bisherige Seite ist genau einem Reiter oder Profil zugeordnet (`apps/web/src/features/workspace/nav-06.test.tsx`, `apps/web/src/features/workspace/tabs.test.ts`).
- [ ] Die Seite Agenten ist nur noch über Einstellungen, KI erreichbar.
- [x] Der Test-Lieferant sieht weder Übersicht noch Mein Tag noch Aktivitäten (`apps/api/src/modules/activities/nav-10.test.ts`, `apps/web/src/features/activities/nav-10.test.tsx`).

## Umsetzung, Schritt 2 der Warteschlange (22.11.2026)

Umfang laut Warteschlange: Kopf, Weiterleitungen, Mein Tag und Aktivitäten aus vorhandenen
Quellen. Offen bleiben die Teile, die KI (KI-03/04/16), AW-01 oder Warengruppen voraussetzen; sie
werden an den genannten Folgeschritten abgenommen. Die Entscheidungen F1 bis F3 aus dem
Prüfbericht stehen aus; wo nötig, gilt die unten genannte vorläufige Wahl.

- **Kopf:** vier Hauptpunkte Übersicht, Mein Tag, Lieferanten, Warengruppen; rechts „Suchen oder
  Reziproq fragen“ und Profil; auf dem Telefon die vier Punkte als Leiste unten. ⌘K bzw. Strg+K
  öffnet Fragen, auf der Seite eines Lieferanten mit `?lieferant=<id>` als Kontext; die API nennt
  den Lieferanten dann in der Anweisung an das Modell (nur wenn die Person ihn sieht).
- **Startseite:** `user_setting` (`org_private`, je Person und Organisation, Policy nur die eigene
  Zeile; vorläufige Wahl zu F2). Leer heißt nach Rolle: Admin und Lead einer Warengruppe starten in
  der Übersicht, alle anderen in Mein Tag. Wahl im Profil unter Anzeige.
- **Weiterleitungen:** `/` zur Startseite der Person, `/start` zu Mein Tag (Lieferantenseite
  unverändert), `/wirkung` zu `/uebersicht`, `/portfolio` zu `/lieferanten?ansicht=matrix`. Die
  Lieferantenliste hat die Ansichten Liste, Matrix und Bewertungsrunde. `/agenten` gibt es noch
  nicht (KI-04); die Seite kommt gleich unter Einstellungen, KI.
- **Übersicht:** bis AW-01 und KI zeigt sie die bestehende Ergebnis-Seite (PNL-10) unter dem neuen
  Titel. Aussage, Ringpaar, drei Sätze, Zeilen und Fragevorschläge kommen mit Schritt 4 und 9.
- **Mein Tag:** die bisherige Startseite unter `/mein-tag`; „Von Reziproq vorbereitet“, „Wo du
  handeln musst“ und „Neu eingegangen“ folgen mit KI und Anbindungen.
- **Lieferant:** vier Reiter Überblick, Aktivitäten, Plan, Ergebnisse und der Knopf Profil; die
  bisherigen Adressen bleiben. Kontaktpunkte stehen unter Profil (in der Tabelle der Spec nicht
  genannt). Wertpotenziale fehlen bis KI-11.
- **Aktivitäten:** Tabelle `note` (`org_private`; Teamnotizen für die Käuferorganisation, private
  nur für die Autorin, auch nicht für Admins; anlegen nur als man selbst). Ändern, anheften und
  löschen nur die eigenen Notizen (Dienst). Der Verlauf liest Notizen, Termine, Hinweise (FS-01)
  und Entwürfe von Reziproq (`ai_draft`) im Dienst statt als SQL-Sicht; die Zeilensicherheit der
  Quellen gilt. Filter Alles, Termine, Notizen, Reziproq; Mails, Transkripte und Dateien kommen
  mit den Anbindungen. Neue Rechte `aktivitaeten.sehen` und `notizen.schreiben` (nur Käufer).
- **Begriffe:** „Wirkung“ heißt in der Oberfläche „Ergebnisse“; Fachbegriffe wie GuV-Wirkung,
  EBIT-Wirkung und Wirkungsart bleiben (CLAUDE.md, Glossar).
- Oberfläche: Aktivitäten nach Vorlage `L-Notizen`, Kopf und Lieferantenleiste nach `Header` und
  `SupplierBar`.

## Nicht Teil dieser Funktion

- Eigene Startseiten oder Widgets je Person
- Mails und Transkripte in den Aktivitäten (kommen mit den Anbindungen)
- Navigation der Lieferantenseite
