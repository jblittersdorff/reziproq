# Designsprache „Zwei Kreise“ · Version 2: Apple-Stil, mobil zuerst

Verbindliche Vorgabe für die Oberfläche von Reziproq. Referenz-Markup mit exakten Werten liegt in `docs/design/referenz/` (ein Ordner mit `.dc.html`-Dateien aus dem Design-Canvas; sie dienen als Vorlage für Aufbau und Werte, nicht als Code zum Übernehmen).

## Was sich in Version 2 ändert

- Die Navigation besteht aus einer Seitenleiste auf dem Desktop und einer Tab-Leiste auf dem Telefon. Die Kopfleiste entfällt.
- Jede Seite folgt fünf Seitenregeln (unten). Sie haben Vorrang vor den Regeln 1 bis 13, wenn beide sich widersprechen.
- Es gibt weniger sichtbare Information. Hilfen und Herleitungen sind eingeklappt.
- Ecken und Schatten sind ruhiger: Karten haben 18 px Ecken und keinen Schatten.
- Seiten werden zuerst für 390 px Breite gebaut.

## Fünf Seitenregeln

1. **Wo bin ich:**
   - großer Titel;
   - darüber ein Zurück-Link mit dem Namen der Ebene darüber („‹ Lieferanten“);
   - markierter Hauptpunkt in Seitenleiste oder Tab-Leiste.
2. **Wo stehe ich im Prozess:**
   - Schrittfolge mit vier Phasen im Überblick;
   - Ablauf-Leiste mit allen Schritten in Abläufen.
3. **Genau eine Karte „Als Nächstes“:**
   - Tinte-Karte mit einem Mint-Knopf.
   - Jeder andere Knopf ist ein Zweitknopf.
   - Auf dem Telefon ist der Knopf so breit wie die Karte. In Prozessschritten steht er unten fest.
4. **Alles andere tritt zurück:**
   - direkt unter „Als Nächstes“ die Karte „Das Wichtigste“: eine Aussage mit Zahl, höchstens drei Punkte, daneben eine einfache Grafik;
   - weiße Gruppen mit Zeilen und graue Abschnittslabels;
   - Hilfen sind eingeklappt.
5. **Mobil zuerst:**
   - unter 760 px Tab-Leiste mit fünf Zielen;
   - Spalten untereinander;
   - Bedienflächen mindestens 44 px.

## Leitidee

Das Logo sind zwei Ringe, die sich überlappen. Das Motiv trägt das Produkt: zwei Seiten und ein geteilter Raum.

- Tinte steht für die eigene Seite.
- Petrol steht für den Lieferanten und für Aktionen.
- Mint steht für das Geteilte und für „jetzt“.

## Dreizehn Regeln

1. Wer handelt, ist ein Kreis: Lieferanten, Personen, Termine, Schritte.
2. Was Inhalt trägt, ist eine weiße Gruppe mit 16 bis 18 px Ecken, ohne Schatten. Listen sind Zeilen in einer Gruppe.
3. Knöpfe, Chips und Filter sind Pillen (voll gerundet). Zeilen sind als Ganzes klickbar und enden mit einem grauen Pfeil.
4. Der Jahreszyklus und jeder Ablauf ist eine Schrittfolge aus Kreisen mit Linie: Petrol mit Haken fertig, Mint mit Tinte-Rand jetzt, grau offen.
5. Je Seite höchstens eine Hauptaktion: Tinte-Karte „Als Nächstes“ mit Mint-Knopf, ohne Ringe im Hintergrund.
6. Privat ist grau mit gestricheltem Rand und Schloss. Geteilt ist Mint mit Doppelring.
7. Ein Entwurf der KI trägt die Zeile „Entwurf von Reziproq“ mit Doppelring, einen dünnen Mint-Rand (1 px `#cfe5dd`) und seine Quellen. Bestätigt entfällt die Zeile.
8. Status steht immer als Text, nie nur als Farbe.
9. Seitentitel nennen die Aufgabe, nicht das Objekt. Karten mit Daten tragen als Titel die Aussage, nicht das Thema.
10. Ergebnisarten (EBIT, Cash, Kostenvermeidung) werden nie addiert.
11. Oben steht die Antwort: Jede Übersicht beginnt mit einem Satz, der das Wichtigste sagt. Erst danach kommen Zahlen und Diagramme.
12. Ringe zeigen Fortschritt zu einem Ziel, sonst nichts. Höchstens zwei, außen Petrol, innen Mint, wie im Logo.
13. Sichtbar ist nur, was die nächste Entscheidung braucht. Alles andere ist eingeklappt oder über „Frag“ erreichbar.

## Farben

| Token | Wert | Einsatz |
|---|---|---|
| `ink` | `#0f1b22` | Dunkle Flächen, eigene Seite, Rand von „jetzt“ |
| `text` | `#14181b` | Fließtext, Titel |
| `petrol` | `#0b7a6a` | Hauptknopf, Links, „fertig“, Lieferantenseite |
| `petrol-dark` | `#0a5c50` | Link im Hover, Text auf Mint-Fläche |
| `mint` | `#4fd1b4` | Knopf und Akzent auf Tinte, „jetzt“ |
| `mint-soft` | `#e1f3ed` | Geteilte Flächen, Leitfragen |
| `mint-line` | `#9fd9c8` | Rand geteilter Flächen |
| `paper` | `#f4f5f2` | Seitengrund, Kopfleiste |
| `card` | `#ffffff` | Karten |
| `line` | `#dfe2dd` | Trennlinien, Rand von Eingaben in Karten |
| `line-soft` | `#eceeea` | Zeilentrenner, neutrale Fläche, Schaltergrund |
| `muted` | `#5a636b` | Sekundärtext |
| `muted-strong` | `#3f4a52` | Text auf neutraler Fläche, inaktive Schalter |
| `ring-open` | `#b9bfba` | Rand offener Ringe, gestrichelter Rand privat |
| `input-border` | `#7b8389` | Rand von Textfeldern und Auswahlfeldern |
| `on-dark` | `#f4f5f2` | Text auf Tinte |
| `on-dark-muted` | `#a9b4b9` | Sekundärtext auf Tinte |
| `track` | `#e6e9e5` | Leere Spur von Ringen und Ziel-Balken |
| `risk` | `#94201a` | Einzige Abweichung in einem Diagramm (Balken, Feld) |
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
| Abschnittslabel | 13 | 600 | 0,04em, Versalien | über Gruppen, Grau `#7b8389` |
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

| Baustein | Beschreibung | Referenz |
|---|---|---|
| Logo | Zwei Ringe (links Tinte, rechts Petrol, Strich 2), Überlappung Mint gefüllt, Wortmarke in Outfit 600 | `Main.dc.html` |
| Seitenleiste | 236 px, Fläche `#eceeea`, rechts 1 px `#e0e3df`; Logo, Suchfeld mit ⌘K, vier Hauptpunkte mit Symbol 20 px, Einstellungen, Person; aktiver Punkt weiß, Symbol Petrol; so hoch wie der Bildschirm, bleibt beim Scrollen stehen (Gründer, 23.11.2026) | `Main.dc.html` |
| Tab-Leiste | unter 760 px fest unten, weiß 93 % mit Unschärfe, fünf Ziele mit Symbol 24 px und Text 11 / 600, aktiv Petrol | `Main.dc.html`, `A-MeinTag.dc.html` |
| Zurück-Link | Pfeil „‹“ und Name der Ebene darüber, Petrol 15 / 600, mindestens 32 px hoch | `SupplierBar.dc.html` |
| Lieferantenkopf | Zurück „‹ Lieferanten“, Name groß, graue Zeile mit Segment und Schritt, runder Knopf „···“ für Profil, Bereiche als Segment-Umschalter, Unterseiten als schlichte Links (aktiv Tinte gefüllt) | `SupplierBar.dc.html` |
| Warengruppenkopf | wie Lieferantenkopf mit „‹ Warengruppen“, ohne Profil-Knopf | `GroupBar.dc.html` |
| Schrittfolge | weiße Gruppe, vier Kreise 26 px mit Linie 2 px; fertig Petrol mit Haken, jetzt Mint mit Tinte-Rand und fettem Text, offen grau | `A-Lieferant.dc.html`, `WG-Start.dc.html` |
| Ablauf-Leiste | weiße Gruppe ohne Schatten, Titel 17, Schritt n von m, Zurück und Weiter als Zweitknopf, alle Schritte, Zeile „Fertig, wenn …“ | `Flow.dc.html` |
| Als Nächstes | Tinte-Karte, Kurzzeile Mint 13 / 600, Titel Outfit 22, optional ein Satz in `on-dark-muted`, Mint-Knopf; auf dem Telefon Knopf volle Breite, 50 bis 52 px hoch | `Main.dc.html`, `Aufgaben.dc.html` |
| Gruppe mit Zeilen | weiße Gruppe, Zeilen 56 px mit Trenner `#eef0ec`, links Monogramm oder Punkt, Titel und Unterzeile, rechts Wert grau, grauer Pfeil | `Main.dc.html`, `L-Ueberblick.dc.html` |
| Abschnittslabel | 13 / 600 Versalien grau über einer Gruppe | `Main.dc.html` |
| Eingeklappt | weiße Zeile 52 px mit Titel 15 / 500 und Pfeil; öffnet den Inhalt darunter; für Leitfragen, Hilfen, Verlauf, Protokoll, Herleitung | `WG-Ziele.dc.html`, `P-Initiative.dc.html` |
| Segment-Umschalter | Fläche `#e6e9e5`, Segmente gleich breit, aktives Segment weiß mit Schatten | `A-Lieferanten.dc.html` |
| Suchfeld | Fläche `#e6e9e5`, 12 px Ecken, Lupe und Platzhalter grau | `A-Lieferanten.dc.html` |
| Monogramm | Kreis 36 bis 38 px, Outfit 600; Warengruppen mit 10 px Ecken | `A-Warengruppen.dc.html` |
| Ampelpunkt | 10 px am Monogramm, Rot `risk`, Gelb `#c98a12`, Petrol; Grund immer als Text in der Zeile | `A-Lieferanten.dc.html` |
| Chip | Pille 12 / 600, Fläche und Text nach Status | überall |
| Knöpfe | Haupt: nur in „Als Nächstes“ (Mint auf Tinte) oder als Speichern im Formular (Petrol). Zweit: Fläche `#e9ece8`, Text Tinte. Höhe 44, Hauptaktion 50 bis 52 | `Aufgaben.dc.html` |
| Privat | Fläche `line-soft`, Rand gestrichelt `ring-open`, Schloss, Chip „privat“ | `P-Initiative.dc.html` |
| Geteilt | Fläche `mint-soft`, Rand `mint-line`, Doppelring, Chip „beide Seiten“ | `L-Ueberblick.dc.html` |
| KI-Entwurf | Weiß, Rand 1 px `#cfe5dd`, Zeile „Entwurf von Reziproq“ mit Doppelring, Quellen als graue Pillen, Übernehmen / Anpassen / Verwerfen | `WG-Markt.dc.html` |
| Leitfragen | eingeklappt; geöffnet Fragen mit Petrol-Ring und Ziffer | `WG-Ziele.dc.html` |
| Das Wichtigste (So-What) | Weiße Gruppe direkt unter „Als Nächstes“: Zeile „Das Wichtigste“ mit Doppelring, eine Aussage mit Zahl in Outfit 19, darunter höchstens drei Zeilen mit Status-Chip (Gut, Hakt, Offen, Wartet, Frist …) und einem Satz; jede Zeile mit Ziel ist ein Link. Daneben, wo es Daten gibt, eine Grafikkarte mit Aussage als Titel: Balken mit Wert rechts, 100-%-Balken mit Legende oder bis zu drei Kennzahlen. Auf dem Telefon untereinander | `C-Claim.dc.html`, `P-Zusagen.dc.html` |
| Hinweis-Karte | grau `#e9ece8`, kein Tinte (Tinte ist der Karte „Als Nächstes“ vorbehalten) | `WG-Ziele.dc.html` |
| Tabelle | Kopf 12 / 600 `muted`, Zeilentrenner `line-soft`, scrollt waagerecht in ihrem Rahmen; auf Übersichten keine Tabellen | `P-Scorecard.dc.html` |
| Zeitachse | Balken voll gerundet; läuft Petrol, geplant `mint-soft`, fertig `line` | `P-Initiativen.dc.html` |
| Ring | ein Ring 92 px in einer weißen Gruppe, daneben Zahl Outfit 28 und Satz | `Uebersicht.dc.html` |
| Diagrammkarte | Gruppe mit Aussage als Titel (Outfit 20), Diagramm, Quelle in 12 px | `D-Diagramme.dc.html` |

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

Ausnahme: Die Seite Übersicht ist ein Lagebild über alle Bereiche. Dort sind erlaubt:
- eine Terminschiene;
- je Bereich eine Diagrammkarte (höchstens vier);
- je Karte eine Aussage, ein Diagramm und ein Link.

Die Übersicht soll gefüllt wirken, aber nichts zeigen, was nicht zu einem Klick in den Bereich führt.

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
| Ring | 92 px, Radius 38, Strich 10, Enden rund, Spur `track` | Übersicht: Ergebnisse gegen Jahresziel (Petrol) |
| Ringpaar | 220 bis 240 px | nur in Auswertungen über „Frag“, nicht mehr auf der Übersicht |
| Einzelring | 56 px, Strich 7 | Kacheln und Zeilen: Fortschritt einer Warengruppe oder Initiative gegen ihr Ziel |
| Kette | 14 px, überlappend | Abläufe und Jahreszyklus (Regel 4), kein Fortschritt in Prozent |

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

## Stand der Vorlagen

Alle Seiten der Käuferseite und der Lieferantenseite haben die Seitenleiste und die Tab-Leiste sowie die Bausteine dieser Version.

Vollständig nach den fünf Regeln gebaut sind:
- Mein Tag, Übersicht, Warengruppen, Warengruppe Überblick, Lieferant Überblick;
- die Muster `A-*`.

Auf allen übrigen Seiten gilt Folgendes:
- Sie haben eine Karte „Als Nächstes“, Zweitknöpfe und eingeklappte Hilfen.
- Ihr Inhalt ist der bisherige. Er wird beim Umsetzen nach Regel 4 weiter gekürzt.

Die Kopfleiste (`Header.dc.html`) ist abgelöst.
