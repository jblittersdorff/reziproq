# Designsprache „Zwei Kreise“ · Version 3.1: KI-nativ, zwei Perspektiven

Verbindliche Vorgabe für die Oberfläche von Reziproq. Referenz-Markup mit exakten Werten liegt in `docs/design/referenz/` (ein Ordner mit `.dc.html`-Dateien aus dem Design-Canvas; sie dienen als Vorlage für Aufbau und Werte, nicht als Code zum Übernehmen).

## Was sich in Version 3 ändert

- Farben folgen der Perspektive: die eigene Seite ist immer Tinte, das Gegenüber immer Petrol, das Geteilte Mint. Das gilt beim Käufer und beim Lieferanten.
- Neue Bausteine für die Arbeit mit Reziproq: Mappe, Kurz prüfen, Erledigt, Warum, Spiegel, Stufen-Umschalter, Kennzeichnung, Blatt, Sichten-, Phasen- und Teile-Umschalter, Demo-Regie (Abschnitt „Bausteine für Reziproq“).
- Schrittfolge und Ablauf-Leiste entfallen. Fortschritt zeigt das Objekt selbst (Phasen am Termin, Teile an der Strategie, „So geht es weiter“ in der Mappe).
- Abschnittslabels sind `#5a636b` statt `#7b8389` (Kontrast).
- Die Seite Übersicht mit Terminschiene und Lagebild wird die Seite Ergebnisse (Name nach E-K2-8).
- Die Änderungen aus Version 2 (Seitenleiste, Tab-Leiste, ruhige Ecken, mobil zuerst) gelten weiter.

## Fünf Seitenregeln

Sie haben Vorrang vor den Regeln darunter, wenn beide sich widersprechen. Sie stehen gleichlautend in NAV-10.

1. **Wo bin ich:** großer Titel; darüber ein Zurück-Link mit dem Namen der Ebene („‹ Lieferanten“); markierter Hauptpunkt.
2. **Genau eine Karte „Als Nächstes“:** Tinte-Karte mit einem Mint-Knopf und höchstens einem Zweitknopf. Jeder andere Knopf ist ein Zweitknopf.
3. **Zusammengefasst von Reziproq:** ein Satz mit belegten Zahlen, Quellen als graue Pillen. Ohne Beleg kein Satz.
4. **Alles andere tritt zurück:** weiße Gruppen mit Zeilen und grauen Abschnittslabels; Details als Blatt; Hilfen, Herleitung und Verlauf eingeklappt.
5. **Mobil zuerst:** unter 760 px Tab-Leiste; Spalten untereinander; Bedienflächen mindestens 44 px.

## Leitidee

Das Logo sind zwei Ringe, die sich überlappen. Das Motiv trägt das Produkt: zwei Seiten und ein geteilter Raum.

- Tinte steht für die eigene Seite, auf beiden Seiten der Beziehung.
- Petrol steht für das Gegenüber und für Aktionen. Beim Käufer ist der Lieferant Petrol, beim Lieferanten der Kunde.
- Mint steht für das Geteilte und für „jetzt“.

## Fünfzehn Regeln

1. Wer handelt, ist ein Kreis: Lieferanten, Personen, Termine, Schritte.
2. Was Inhalt trägt, ist eine weiße Gruppe mit 16 bis 18 px Ecken, ohne Schatten. Listen sind Zeilen in einer Gruppe.
3. Knöpfe, Chips und Filter sind Pillen (voll gerundet). Zeilen sind als Ganzes klickbar und enden mit einem grauen Pfeil.
4. Phasen und Teile eines Objekts sind Schrittkreise mit Linie: Tinte mit Mint-Ziffer jetzt, Petrol mit Haken fertig, Ring `#b9bfba` offen. Es gibt keine Ablauf-Leiste über Seiten hinweg.
5. Je Seite höchstens eine Hauptaktion: Tinte-Karte „Als Nächstes“ mit Mint-Knopf, ohne Ringe im Hintergrund.
6. Privat ist grau mit gestricheltem Rand und Schloss. Geteilt ist Mint mit Doppelring.
7. Ein Entwurf der KI trägt die Zeile „Entwurf von Reziproq“ mit Doppelring, einen dünnen Mint-Rand (1 px `#cfe5dd`) und seine Quellen. Bestätigt entfällt die Zeile.
8. Status steht immer als Text, nie nur als Farbe.
9. Seitentitel nennen die Aufgabe, nicht das Objekt. Karten mit Daten tragen als Titel die Aussage, nicht das Thema.
10. Wertarten (EBIT, Kostenvermeidung, Cash) werden nie addiert, auch nicht in einem Satz. Wo sie nebeneinander stehen, steht der Hinweis „nie addiert“.
11. Oben steht die Antwort: Jede Übersicht beginnt mit einem Satz, der das Wichtigste sagt. Erst danach kommen Zahlen und Diagramme.
12. Ringe zeigen Fortschritt zu einem Ziel, sonst nichts. Höchstens zwei, außen Petrol, innen Mint, wie im Logo.
13. Sichtbar ist nur, was die nächste Entscheidung braucht. Alles andere ist eingeklappt oder über „Frag“ erreichbar.
14. Jede Nachricht in die Mitte trägt ihre Kennzeichnung: Mensch, mit Reziproq oder Reziproq.
15. Der Spiegel zeigt links immer die eigene Seite (Tinte), rechts das Gegenüber (Petrol), dazwischen die Naht in Mint. Der Wert des Gegenübers erscheint nur privat und immer mit „≈“ als Spanne.

## Farben

| Token | Wert | Einsatz |
|---|---|---|
| `ink` | `#0f1b22` | Dunkle Flächen, eigene Seite (beide Perspektiven), Rand von „jetzt“ |
| `text` | `#14181b` | Fließtext, Titel |
| `petrol` | `#0b7a6a` | Hauptknopf, Links, „fertig“, Gegenüber |
| `petrol-dark` | `#0a5c50` | Link im Hover, Text auf Mint-Fläche |
| `mint` | `#4fd1b4` | Knopf und Akzent auf Tinte, „jetzt“ |
| `mint-soft` | `#e1f3ed` | Geteilte Flächen, Leitfragen |
| `mint-line` | `#9fd9c8` | Rand geteilter Flächen |
| `paper` | `#f4f5f2` | Seitengrund, Kopfleiste |
| `card` | `#ffffff` | Karten |
| `line` | `#dfe2dd` | Trennlinien, Rand von Eingaben in Karten |
| `line-soft` | `#eceeea` | Zeilentrenner, neutrale Fläche, Schaltergrund |
| `muted` | `#5a636b` | Sekundärtext, Abschnittslabels |
| `muted-strong` | `#3f4a52` | Text auf neutraler Fläche, inaktive Schalter |
| `ring-open` | `#b9bfba` | Rand offener Ringe, gestrichelter Rand privat |
| `input-border` | `#7b8389` | Rand von Textfeldern und Auswahlfeldern |
| `on-dark` | `#f4f5f2` | Text auf Tinte |
| `on-dark-muted` | `#a9b4b9` | Sekundärtext auf Tinte |
| `track` | `#e6e9e5` | Leere Spur von Ringen und Ziel-Balken |
| `risk` | `#94201a` | Einzige Abweichung in einem Diagramm (Balken, Feld) |
| `amber` | `#c98a12` | Ampelpunkt Achtung (nie als Textfarbe) |
| `dark-2` | `#2e3e47` | Zweitknopf und leere Spur auf Tinte |

Status (immer Fläche plus Text):

| Status | Fläche | Text |
|---|---|---|
| gut | `#e8f1df` | `#2f5f1d` |
| Achtung | `#f8eed6` | `#74500a` |
| kritisch | `#fae6e3` | `#94201a` |
| neutral | `#eceeea` | `#3f4a52` |
| geteilt | `#e1f3ed` | `#0a5c50` |
| Tinte | `#0f1b22` | `#4fd1b4` |

Es gibt nur ein helles Thema. Kein Farbverlauf, kein farbiger Schatten.

## Schrift

- Titel, große Zahlen, Monogramme: **Outfit**, Gewicht 600.
- Text und Bedienelemente: **Figtree**, 400 bis 700.
- Beide Schriften selbst ausliefern (zum Beispiel über `@fontsource`), nicht von Google laden.

| Stufe | Größe / Zeilenhöhe | Gewicht | Laufweite | Einsatz |
|---|---|---|---|---|
| Titel | 34 bis 36 / 1,08 | 700 | −0,03em | jede Seite; auf dem Telefon 30 |
| Titel im Kopf | 28 bis 36 / 1,08 | 600 | −0,03em | Name im Lieferanten- und Warengruppenkopf |
| Titel „Als Nächstes“ | 22 / 1,2 | 600 | −0,02em | Karte „Als Nächstes“ |
| Zeile | 16 / 600, Unterzeile 14 / 400 grau | | 0 | Zeilen in Gruppen |
| Abschnittslabel | 13 | 600 | 0,04em, Versalien | über Gruppen, Grau `#5a636b` |
| Abschnitt | 22 | 600 | −0,02em | Kartentitel auf Start |
| Abschnitt klein | 19 | 600 | −0,015em | Kartentitel |
| Kennzahl | 28 bis 30 | 600 | −0,02em | Große Zahlen, Tabellenziffern |
| Text | 14 bis 16 / 1,5 | 400 | 0 | Fließtext |
| Klein | 13 | 400 bis 600 | 0 | Sekundärzeilen, Labels |
| Chip | 12 | 600 | 0 | Chips, Tabellenköpfe |

Titel umbrechen ausgeglichen. Zahlen in Spalten sind Tabellenziffern. Versalien mit leichter Sperrung nur für Abschnittslabels über Gruppen.

## Form

| Element | Ecken | Rand oder Schatten |
|---|---|---|
| Gruppe, Karte | 16 bis 18 px | keiner |
| Tinte-Karte „Als Nächstes“ | 22 bis 24 px | keiner |
| Segment-Umschalter | 12 px, aktives Segment 9 px | aktives Segment `0 1px 3px #0f1b2222` |
| Eingeklappter Bereich | 16 px | keiner, Pfeil rechts dreht beim Öffnen |
| Feld in einer Karte | 16 bis 20 px | Fläche `paper` |
| Knopf, Chip, Filter | 999 px | Zweitknopf: Fläche `#e9ece8`, kein Rand |
| Eingabefeld groß (Frage) | 28 px | `0 0 0 1px #0f1b2214, 0 6px 20px #0f1b220a` |
| Aktiver Schalter | 999 px | `0 1px 2px #0f1b221f` |
| Monogramm, Datum, Schritt | Kreis | – |

Bedienflächen sind mindestens 44 px hoch, Zeilen 56 px. Abstände in Schritten von 4 px; zwischen Gruppen 22 px. Inhaltsbreite bis 1200 px. Startseiten der Hauptpunkte und Überblicke nutzen auf dem Desktop zwei Spalten (Arbeit links, Kontext rechts: Termine, Kennzahlen, Personen). Unter 1100 px eine Spalte. Eine schmale Spalte mit viel Leerraum wirkt auf dem Desktop unfertig.

## Bausteine

Nennt eine Zeile ein Board, das nicht in `docs/design/referenz/` liegt (`Aufgaben`, `C-Claim`, `P-Zusagen`, `P-Scorecard`, `P-Initiativen`, `WG-Markt`, `WG-Ziele`), gilt das ähnlichste beiliegende Board, etwa `L-Ueberblick`, `W-Initiative` oder `K6-Strategie` (E-K0-32).

| Baustein | Beschreibung | Referenz |
|---|---|---|
| Logo | Zwei Ringe (links Tinte, rechts Petrol, Strich 2), Überlappung Mint gefüllt, Wortmarke in Outfit 600 | `Main.dc.html` |
| Seitenleiste | 236 px, Fläche `#eceeea`, rechts 1 px `#e0e3df`; Logo, Feld „Frag Reziproq“ mit ⌘K, vier Hauptpunkte mit Symbol 20 px (Heute mit Zahl), Zeile „Im Hintergrund“ (13 px, Punkt Petrol), Mein Agent, Einstellungen, Person; aktiver Punkt weiß, Symbol Petrol; so hoch wie der Bildschirm, scrollt nicht mit (E-K0-02). Beim Lieferanten Heute, Kunden und „<Name> · <Firma>“ | `Main.dc.html`, `L5-Heute.dc.html` |
| Tab-Leiste | unter 760 px fest unten, weiß 93 % mit Unschärfe, Symbol 24 px und Text 11 / 600, aktiv Petrol; Käufer fünf Ziele, Lieferant drei | `Main.dc.html`, `A-MeinTag.dc.html` |
| Zurück-Link | Pfeil „‹“ und Name der Ebene darüber, Petrol 15 / 600, mindestens 32 px hoch | `SupplierBar.dc.html` |
| Akte-Kopf | Zurück „‹ Lieferanten“ (beim Lieferanten „‹ Kunden“), Monogramm 56 px in der Farbe des Gegenübers, Name groß, graue Zeile (Segment, Warengruppen, Spend, Lead, Jahreszyklus), Aktionen von Reziproq als Zweitknöpfe, „···“ für Profil, Team, Mandat, darunter der Sichten-Umschalter | `SupplierBar.dc.html`, `L-Ueberblick.dc.html`, `L5-Akte.dc.html` |
| Warengruppenkopf | „‹ Warengruppen“, Monogramm mit 10 px Ecken, Name, graue Zeile (Lieferanten, Spend, Prognose, Lead, Stand der Strategie), Aktionen Strategie und Entwurf fortschreiben | `WG-Start.dc.html` |
| Als Nächstes | Tinte-Karte, Kurzzeile Mint 13 / 600, Titel Outfit 22, optional ein Satz in `on-dark-muted`, Mint-Knopf; auf dem Telefon Knopf volle Breite, 50 bis 52 px hoch | `Main.dc.html`, `Aufgaben.dc.html` |
| Gruppe mit Zeilen | weiße Gruppe, Zeilen 56 px mit Trenner `#eef0ec`, links Monogramm oder Punkt, Titel und Unterzeile, rechts Wert grau, grauer Pfeil | `Main.dc.html`, `L-Ueberblick.dc.html` |
| Abschnittslabel | 13 / 600 Versalien `#5a636b` über einer Gruppe | `Main.dc.html` |
| Eingeklappt | weiße Zeile 52 px mit Titel 15 / 500 und Pfeil; öffnet den Inhalt darunter; für Leitfragen, Hilfen, Verlauf, Protokoll, Herleitung | `WG-Ziele.dc.html`, `P-Initiative.dc.html` |
| Segment-Umschalter | Fläche `#e6e9e5`, Segmente gleich breit, aktives Segment weiß mit Schatten | `A-Lieferanten.dc.html` |
| Suchfeld | Fläche `#e6e9e5`, 12 px Ecken, Lupe und Platzhalter grau | `A-Lieferanten.dc.html` |
| Monogramm | Kreis 36 bis 38 px, Outfit 600; Warengruppen mit 10 px Ecken | `A-Warengruppen.dc.html` |
| Ampelpunkt | 10 px am Monogramm, Rot `risk`, Gelb `#c98a12`, Petrol; Grund immer als Text in der Zeile | `A-Lieferanten.dc.html` |
| Chip | Pille 12 / 600, Fläche und Text nach Status | überall |
| Filter-Chips | Pillen 44 px hoch mit Name und Zahl („Meine · 6“), gewählt Tinte mit hellem Text, sonst weiß mit Rand `line`; „Mehr Filter“ öffnet einen Bereich darunter und trägt die Zahl der gesetzten Filter | `Lieferanten.dc.html` |
| Segment-Matrix | Felder des Segmentmodells (2 × 2 oder 3 × 3) als Flächen `paper`, Zeilen nach Impact absteigend, Spalten nach Qualität aufsteigend; das Feld mit beiden höchsten Stufen Mint. Je Feld „Name · Zahl“ in Outfit 17, Spend grau, bis drei Namen als weiße Pillen und „und N weitere“; strittig mit Rand `amber` und dem Wort „strittig“. Ein Feld ist als Ganzes ein Link | `K2-Segmente.dc.html` |
| Knöpfe | Haupt: nur in „Als Nächstes“ (Mint auf Tinte) oder als Speichern im Formular (Petrol). Zweit: Fläche `#e9ece8`, Text Tinte. Höhe 44, Hauptaktion 50 bis 52 | `Aufgaben.dc.html` |
| Privat | Fläche `line-soft`, Rand gestrichelt `ring-open`, Schloss, Chip „privat“ | `P-Initiative.dc.html` |
| Geteilt | Fläche `mint-soft`, Rand `mint-line`, Doppelring, Chip „beide Seiten“ | `L-Ueberblick.dc.html` |
| KI-Entwurf | Weiß, Rand 1 px `#cfe5dd`, Zeile „Entwurf von Reziproq“ mit Doppelring, Quellen als graue Pillen, Übernehmen / Anpassen / Verwerfen | `WG-Markt.dc.html` |
| Leitfragen | Fragezeichen neben der Teilüberschrift einer Strategie; geöffnet Fragen mit Petrol-Ring und Ziffer | `K6-Strategie.dc.html` |
| Das Wichtigste (So-What) | Weiße Gruppe direkt unter „Als Nächstes“: Zeile „Das Wichtigste“ mit Doppelring, eine Aussage mit Zahl in Outfit 19, darunter höchstens drei Zeilen mit Status-Chip (Gut, Hakt, Offen, Wartet, Frist …) und einem Satz; jede Zeile mit Ziel ist ein Link. Daneben, wo es Daten gibt, eine Grafikkarte mit Aussage als Titel: Balken mit Wert rechts, 100-%-Balken mit Legende oder bis zu drei Kennzahlen. Auf dem Telefon untereinander | `C-Claim.dc.html`, `P-Zusagen.dc.html` |
| Hinweis-Karte | grau `#e9ece8`, kein Tinte (Tinte ist der Karte „Als Nächstes“ vorbehalten) | `WG-Ziele.dc.html` |
| Tabelle | Kopf 12 / 600 `muted`, Zeilentrenner `line-soft`, scrollt waagerecht in ihrem Rahmen; auf Übersichten keine Tabellen | `P-Scorecard.dc.html` |
| Zeitachse | Balken voll gerundet; läuft Petrol, geplant `mint-soft`, fertig `line` | `P-Initiativen.dc.html` |
| Ring | ein Ring 92 px in einer weißen Gruppe, daneben Zahl Outfit 28 und Satz; nur EBIT gegen Jahresziel | `Uebersicht.dc.html` (Wert) |
| Diagrammkarte | Gruppe mit Aussage als Titel (Outfit 20), Diagramm, Quelle in 12 px | `D-Diagramme.dc.html` |

## Bausteine für Reziproq

| Baustein | Beschreibung | Referenz |
|---|---|---|
| Mappe | Seite für eine Entscheidung: Kopf mit „‹ Heute“, Als Nächstes mit Empfehlung, fünf Teile (worum es geht, Belege, Optionen mit Wert für beide Seiten, Empfehlung, dein Schritt); rechts „So geht es weiter“ als Schrittkreise und „Nur für dich“ (privat) | `K1-Mappe.dc.html`, `K5-Deal-Mappe.dc.html` |
| Kurz prüfen | ein Entwurf je Karte mit Kontext, Text, Quellen; Fortschrittsbalken Petrol; Knopf „Übernehmen“ Petrol als Zweitknopf-Form (kein Hauptknopf), Anpassen, Verwerfen mit Grund, Später; Tastatur Enter und V | `K1-Kurz-Pruefen.dc.html`, `K1-Kurz-Pruefen-Mobil.dc.html` |
| Erledigt-Zeile | Uhrzeit Outfit 14 tabellarisch, Aufgabe als Chip, Text, Objekt, rechts Zweitknopf „Zurücknehmen“ oder „Warum“ | `Erledigt.dc.html` |
| Warum | Blatt oder Seite mit Rechenweg (Tabelle mit Quelle je Zeile), Formulierung, Lauf (Aufgabe, Zeit, Schritte, Kosten, Rechte) | `K1-Warum.dc.html` |
| Spiegel | zwei Balken gegeneinander, links eigene Seite Tinte, rechts Gegenüber Petrol, Naht 3 × 16 px Mint; Werte außen; darunter „<Gegenüber> sieht dieselben Zahlen“ oder „nur für euch“ | `L-Ueberblick.dc.html`, `L5-Akte.dc.html` |
| Mini-Spiegel | 200 px breit, Balken 8 px, mobil 64 px; Spiegel je Frage im Feedback 12 px | `K2-Feedback.dc.html` |
| Wertart-Kachel | je Wertart eine Kachel (EBIT, Kostenvermeidung, Cash) mit Zahl Outfit 28, darunter „gesichert“ oder „geschätzt“; Hinweis „nie addiert“ unter der Reihe | `Uebersicht.dc.html` |
| Reife | Chip R1 bis R5 neutral, R5 gut („Realisiert“) | `W-Initiative.dc.html` |
| Stufen-Umschalter | Segment-Umschalter Vorschlagen, Vorbereiten, Erledigen; Stufen über der Obergrenze ausgegraut mit Schloss | `Mein-Agent.dc.html` |
| Kennzeichnung | Doppelring 14 px und Chip: „mit Reziproq“ und „Reziproq“ geteilt (`#e1f3ed` / `#0a5c50`), „Mensch“ neutral; daneben Name und Zeit | `K5-Deal.dc.html` |
| Entwurf von Reziproq | wie KI-Entwurf; Zeile „Zusammengefasst von Reziproq“ mit Quellen-Pillen über Sätzen | `Main.dc.html` |
| Sichten-Umschalter | Segment-Umschalter mit Symbolen: Doppelring Gemeinsam, Schloss Nur für dich, Petrol-Punkt Von <Gegenüber>; setzt die Adresse | `K2-Akte-Privat.dc.html` |
| Von <Gegenüber> | weiße Gruppe mit Petrol-Kante links 4 px | `K2-Akte-Geteilt.dc.html` |
| Monogramm nach Seite | eigene Personen Tinte, Personen des Gegenübers Petrol; beim Lieferanten umgekehrt zugeordnet | `L5-Akte.dc.html` |
| Blatt | 620 px von rechts, Fläche `paper`, Schatten `-12px 0 40px #0f1b2233`, Hintergrund Tinte 25 %; Titel Outfit 28, runder Schließen-Knopf 44 px; Esc schließt; mobil volle Seite; erlaubt nach E-K0-01 | `K2-Profil.dc.html`, `K5-Szenarien.dc.html` |
| Datumskreis | Kreis 44 px mit Tag und Monat; Petrol, wenn das Gegenüber am Zug ist; im Termin-Kopf 56 px | `Termin-Briefing.dc.html` |
| Phasen-Umschalter | Schrittkreise 22 px mit Linie: aktiv Tinte mit Mint-Ziffer, erledigt Petrol mit Haken, offen Ring `#b9bfba`; Text darunter | `Termin-Briefing.dc.html` |
| Teile-Umschalter | wie Phasen-Umschalter, je Teil Stand als Text (bestätigt, jetzt, Entwurf) | `K6-Strategie.dc.html` |
| Agenda-Zeile | Uhrzeit Outfit 14 tabellarisch, Titel, je Seite Monogramm 24 px und Chip | `Termin-Briefing.dc.html` |
| Folie | 16:10 weiß, Rand 1 px `#dfe2dd`, Diagramme nach Abschnitt Diagramme, Quelle 12 px | `J-Deck.dc.html` |
| Schalter | 52 × 32 px, an Petrol, aus `#b9bfba`, Knopf weiß; mit Label und Unterzeile in einer Zeile | `L5-Deal-Mappe.dc.html`, `K7-Kanaele.dc.html` |
| Fremdes Programm | neutrale Fensterleiste ohne Marke, Reziproq als Seitenbereich rechts oder als Karte; Hinweis „Vorschau, stark vereinfacht“ | `K7-Mail.dc.html`, `K7-Teams.dc.html` |
| Wert-Pipeline | vier Felder nebeneinander (Potenzial, beschlossen, umgesetzt, gesichert), Kurzzeile 12 / 600 Versalien, Zahl Outfit 22; die aktuelle Stufe Tinte mit weißer Zahl, sonst weiß mit Rand 1 px `#dfe2dd`; nur eine Wertart je Reihe | `K8-Warengruppe.dc.html` |
| Hypothesen-Zeile | Code und Behauptung, Unterzeile mit Wert und kritischer Annahme, rechts „Sicherheit <Stufe>“ in `muted` und Stand als Chip (im Plan gut, gefährdet Achtung, verletzt kritisch, bestätigt gut, offen neutral) | `K8-Warengruppe.dc.html`, `K8-Hypothese.dc.html` |
| Option mit getrennten Größen | Zeile mit Titel, Unterzeile und drei Zahlen nebeneinander (je Zahl Outfit 15 mit Einheit darunter in 12 px), nie zusammengezählt; rechts Kennzeichnung (Empfohlen, Regel verletzt, Sicherheit) | `K8-Anteile.dc.html`, `K8-Vergabe-Mappe.dc.html` |
| Abstand-Balken | waagerechter Balken je Lieferant, Wert rechts; die eine Abweichung in `risk`, übrige Petrol | `K8-Soll-Kosten.dc.html` |
| Runde einer Verhandlung | Zeile mit Runde und Zeit, Kennzeichnung „Reziproq für <Organisation>“, darunter der Text in 15 px; auf beiden Seiten gleich | `K8-Verhandlung.dc.html`, `L8-Angebot.dc.html` |
| Demo-Regie | Leiste Tinte oben mit Drehbuch, Schritt, Uhrzeit des Demo-Mandanten, Rolle; nur im Demo-Mandanten | `Demo-Regie.dc.html`, `K5-Zwei-Fenster.dc.html` |

## Informationsdichte: die Antwort zuerst

Reziproq zeigt nicht alles, was es weiß. Jede Ansicht hat drei Schichten:

| Schicht | Was | Sichtbar |
|---|---|---|
| 1 Aussage | Ein Satz mit der Antwort und ihrer wichtigsten Zahl („Guss liefert, Leiterplatten wartet auf die Freigabe.“) | immer, ganz oben |
| 2 Beleg | Höchstens ein Ringpaar oder ein Diagramm und bis zu vier Zahlen, die die Aussage beweisen | immer |
| 3 Daten | Tabellen, weitere Schnitte, Rohdaten, Herleitung | verborgen: Klick auf eine Zeile, „Details“ oder „Frag Reziproq“ |

Grenzen je Ansicht:
- eine Aussage;
- höchstens vier Kennzahlen sichtbar;
- höchstens zwei Diagramme;
- eine Tinte-Karte.

Ausnahme: Die Seite Ergebnisse zeigt drei Wertart-Kacheln, den Ring gegen das Jahresziel, Säulen je Quartal und das Wertkonto je Beziehung. Jede Zahl führt mit einem Klick zu ihrer Herleitung.

Tabellen mit vielen Zeilen gehören auf Arbeitsseiten, nicht auf Übersichten.

Aussagen:
- Aussagen schlägt Reziproq vor. Sie tragen die Zeile „Zusammengefasst von Reziproq“ und Quellen als graue Pillen.
- Jede Zahl im Satz muss im Beleg stehen, sonst wird der Satz nicht angezeigt.
- Ohne belastbare Aussage zeigt die Ansicht nur den Beleg, nie einen Platzhalter.

Die dritte Schicht erreicht der Einkäufer über einen Klick auf eine Zeile, über einen eingeklappten Bereich oder über „Frag“. Die Seite wird dadurch nicht voller.

## Ringe

Die Ringe kommen aus dem Logo: zwei Kreise, eine gemeinsame Sache.

| Variante | Maße | Einsatz |
|---|---|---|
| Ring | 92 px, Radius 38, Strich 10, Enden rund, Spur `track` | Wert: EBIT gesichert gegen Jahresziel (Petrol) |
| Ringpaar | 220 bis 240 px | nur in Auswertungen über „Frag“ |
| Einzelring | 56 px, Strich 7 | Kacheln und Zeilen: Fortschritt einer Warengruppe oder Initiative gegen ihr Ziel |
| Kette | 14 px, überlappend | Jahreszyklus in der grauen Zeile des Akte-Kopfs, kein Fortschritt in Prozent |

Regeln:
- Ein Ring braucht ein Ziel. Ohne Ziel gibt es keinen Ring, sondern eine Zahl.
- Neben jedem Ring stehen Zahl, Ziel und Einheit als Text. Der Ring allein trägt keine Information.
- Bei 0 % zeigt der Ring nur die Spur, keinen Punkt.
- Ringe nie für Anteile eines Ganzen, nie mehr als zwei ineinander.

## Diagramme

Die Form folgt der Frage, die das Diagramm beantwortet. Die Grundlage sind die fünf Arten von Vergleichen nach Gene Zelazny (McKinsey) und die Brücke als Standard der Beratungen für Veränderungen.

| Frage des Einkäufers | Form | Beispiel |
|---|---|---|
| Wie weit sind wir zum Ziel? | Ring oder Ziel-Balken | Ergebnisse gegen Jahresziel |
| Wie kommen wir von A nach B? | Brücke (Wasserfall) | Preis 2026 zu 2027 nach Treibern |
| Wer ist größer, wer kleiner? | Balken waagerecht, sortiert | Spend je Lieferant |
| Wo liegen wir gegen Ziel? | Ziel-Balken mit Strich | Kennzahlen der Scorecard |
| Wie entwickelt es sich? | Säulen (bis 8 Perioden) oder Linie | Gesichert je Quartal |
| Wie verschiebt sich die Verteilung? | zwei 100-%-Balken, Ist und Soll | Anteile in der Warengruppe |
| Wo stehen die Lieferanten? | Matrix 3 × 3 | Business Impact × Beziehungsqualität |
| Wo ist was groß, und wie ist es verteilt? | Mekko (Breite = Größe, Höhe = Anteil) | Abhängigkeit je Warengruppe |

Regeln:
1. Der Titel ist die Aussage mit Zahl, nicht das Thema.
2. Ein Diagramm, eine Botschaft.
3. Petrol für das, was zählt, Grau (`ring-open`) für den Rest. `risk` nur für die eine Abweichung, Mint für Neues oder Teilwerte.
4. Werte direkt an die Form schreiben. Keine Legende, keine Gitterlinien, keine 3D, keine Schatten.
5. Rangfolgen der Größe nach sortieren, Zeit von links nach rechts.
6. Keine Torten. Höchstens zwei bis drei Teile, und dann besser ein 100-%-Balken.
7. Quelle und Einheit klein darunter.
8. Zahlen kommen aus dem Code, nie aus einem Modell.

Vorlage mit allen Formen: `D-Diagramme.dc.html`.

## Bedienbarkeit

- Text mindestens 4,5:1 zum Grund, auch 12 px graue Labels.
- Echte Knöpfe, Links und Formularfelder mit Label. Symbolknöpfe haben einen Namen.
- Sichtbarer Fokusrahmen auf allen Bedienelementen.
- Zustände unterscheiden sich in Text und Helligkeit, nicht nur im Farbton.
- Jede Seite wird zuerst für 390 px Breite gebaut. Tabellen scrollen im Rahmen, die Seite selbst nie seitwärts.
- Eingeklappte Bereiche sind echte `<details>`-Elemente oder gleichwertig mit Tastatur bedienbar.
- Die feste Tab-Leiste verdeckt keinen Inhalt. Der Inhalt hat unten 92 px Abstand.

## Prüfungen beim Bauen (T-CI1 bis T-CI3)

Die Palette sind alle Hex-Werte dieses Dokuments. Eine neue Farbe kommt zuerst hierher, dann in `tokens.css`. Die Prüfungen laufen in `pnpm check` an den Quellen (`apps/web/src/styles/build-checks.node.test.ts`) und am ausgelieferten Build von App und Website (`e2e/t-ci.spec.ts`).

- **T-CI1 Farben:** `tokens.css` enthält jede Farbe der Palette und keine andere. Im gebauten CSS steht nur eine Farbe der Palette, auch mit Deckkraft (etwa Tinte 25 %). Benannte Farben wie `red`, Farbfunktionen mit festen Werten und andere Hex-Werte sind Fehler.
- **T-CI2 Schriften:** Figtree und Outfit liegen als woff2 im Build und laden im Browser vom eigenen Server. Keine andere eigene Schrift, kein `@import` und keine Datei von außen, kein Schriftendienst wie Google Fonts.
- **T-CI3 Ein helles Thema:** kein dunkles Thema, auch nicht über `prefers-color-scheme`; `color-scheme: light`; kein Farbverlauf. Schatten mit Unschärfe nur in Tinte. Ränder, die als Schatten ohne Unschärfe gezeichnet sind, dürfen jede Farbe der Palette haben. Auch bei dunkel eingestelltem System bleibt die Seite hell.

## Stand der Vorlagen

`docs/design/referenz/` enthält nur die gültigen Boards aus dem Canvas (Version 1795540849-2ac5), ohne Archiv, ohne Claims, Risiko und Vertrag und ohne verworfene Varianten. Jede Spec nennt im Kopf ihre Bildvorlagen. Die Baustein-Boards `GroupBar`, `Flow` und `Header` sind abgelöst und liegen nicht mehr bei; `SupplierBar` zeigt den Akte-Kopf und bleibt.

Kapitel 8 nutzt dieselben Bausteine; neu sind Wert-Pipeline, Hypothesen-Zeile, Option mit getrennten Größen, Abstand-Balken und Runde einer Verhandlung.

Bewusst nicht gezeichnet und in den Specs beschrieben: Mein Agent und Einstellungen beim Lieferanten, Sicht „Von <Kunde>“, Teile 1, 2 und 4 der Strategie aufgeklappt, Chat-Karte „Plan intern freigeben“, Benachrichtigungs-Mail an Lieferanten. Sie nutzen die Bausteine dieses Dokuments.
