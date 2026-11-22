# Designsprache „Zwei Kreise“

Verbindliche Vorgabe für die Oberfläche von Reziproq. Referenz-Markup mit exakten Werten liegt in `docs/design/referenz/` (ein Ordner mit `.dc.html`-Dateien aus dem Design-Canvas; sie dienen als Vorlage für Aufbau und Werte, nicht als Code zum Übernehmen).

## Leitidee

Das Logo sind zwei Ringe, die sich überlappen. Das Motiv trägt das Produkt: zwei Seiten und ein geteilter Raum.

- Tinte steht für die eigene Seite.
- Petrol steht für den Lieferanten und für Aktionen.
- Mint steht für das Geteilte und für „jetzt“.

## Dreizehn Regeln

1. Wer handelt, ist ein Kreis: Lieferanten, Personen, Termine, Schritte.
2. Was Inhalt trägt, ist eine Karte mit 24 px Ecken.
3. Alles Klickbare ist eine Pille (voll gerundet).
4. Der Jahreszyklus und jeder Ablauf ist eine Kette aus Ringen: Petrol fertig, Mint mit Tinte-Rand jetzt, weiß mit grauem Rand offen.
5. Je Seite höchstens eine Hauptaktion: Tinte-Karte „Nächster Schritt“ mit Ringen im Hintergrund und Mint-Knopf.
6. Privat ist grau mit gestricheltem Rand und Schloss. Geteilt ist Mint mit Doppelring.
7. Ein Entwurf der KI hat einen gestrichelten Petrol-Rand und nennt seine Quellen. Bestätigt wird der Rand fest.
8. Status steht immer als Text, nie nur als Farbe.
9. Seitentitel nennen die Aufgabe, nicht das Objekt. Karten mit Daten tragen als Titel die Aussage, nicht das Thema.
10. Ergebnisarten (EBIT, Cash, Kostenvermeidung) werden nie addiert.
11. Oben steht die Antwort: Jede Übersicht beginnt mit einem Satz, der das Wichtigste sagt. Erst danach kommen Zahlen und Diagramme.
12. Ringe zeigen Fortschritt zu einem Ziel, sonst nichts. Höchstens zwei, außen Petrol, innen Mint, wie im Logo.
13. Sichtbar ist nur, was eine Entscheidung braucht. Alles andere ist verborgen und über einen Klick oder „Frag Reziproq“ erreichbar.

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
| Titel groß | 46 / 1,04 | 600 | −0,035em | Startseite |
| Titel | 42 / 1,05 | 600 | −0,035em | Listenseiten |
| Titel Arbeitsseite | 36 / 1,08 | 600 | −0,03em | Seiten mit Lieferanten- oder Ablauf-Leiste |
| Abschnitt | 22 | 600 | −0,02em | Kartentitel auf Start |
| Abschnitt klein | 19 | 600 | −0,015em | Kartentitel |
| Kennzahl | 28 bis 30 | 600 | −0,02em | Große Zahlen, Tabellenziffern |
| Text | 14 bis 16 / 1,5 | 400 | 0 | Fließtext |
| Klein | 13 | 400 bis 600 | 0 | Sekundärzeilen, Labels |
| Chip | 12 | 600 | 0 | Chips, Tabellenköpfe |

Titel umbrechen ausgeglichen. Zahlen in Spalten sind Tabellenziffern. Keine Versalien mit Sperrung für Abschnittslabels.

## Form

| Element | Ecken | Rand oder Schatten |
|---|---|---|
| Karte | 24 px | `0 0 0 1px #0f1b220a` |
| Tinte-Karte „Nächster Schritt“ | 28 px (24 px in einer Karte) | keiner |
| Feld in einer Karte | 16 bis 20 px | Fläche `paper` |
| Knopf, Chip, Filter, Suchfeld, Schalter | 999 px | Zweitknopf: innen 1 px `line` |
| Eingabefeld groß (Frage) | 28 px | `0 0 0 1px #0f1b2214, 0 6px 20px #0f1b220a` |
| Aktiver Schalter | 999 px | `0 1px 2px #0f1b221f` |
| Monogramm, Datum, Schritt | Kreis | – |

Bedienflächen sind mindestens 44 px hoch. Abstände in Schritten von 4 px; zwischen Karten 20 bis 28 px.

## Bausteine

| Baustein | Beschreibung | Referenz |
|---|---|---|
| Logo | Zwei Ringe (links Tinte, rechts Petrol, Strich 2), Überlappung Mint gefüllt, Wortmarke in Outfit 600 | `Header.dc.html` |
| Kopfleiste | Grund `paper`, 68 px, Navigation als Schalter auf `line-soft`, aktiver Punkt weiß; Profil als Tinte-Kreis mit Mint-Initialen | `Header.dc.html` |
| Lieferanten-Leiste | Weiß; Monogramm-Kreis 52 px mit Petrol-Innenrand, Name in Outfit 26; rechts Kette mit Schritt; Bereiche als Reiter mit 3 px Tinte-Unterstrich; Unterseiten als Pillen auf `paper` | `SupplierBar.dc.html` |
| Warengruppen-Leiste | Wie Lieferanten-Leiste, Monogramm als Tinte-Kreis mit Mint-Text, Stand als Chip | `GroupBar.dc.html` |
| Ablauf-Leiste | Weiße Karte mit Chip „Ablauf“, Titel, Schritt n von m, Zurück und Weiter, Ringe mit Verbindungslinien, Zeile „Fertig, wenn …“ | `Flow.dc.html` |
| Nächster Schritt | Tinte-Karte, Mint-Zeile darüber, Titel in Outfit, Ringe als Hintergrund rechts, Mint-Knopf mit Pfeil im Tinte-Kreis | `Main.dc.html` |
| Kette | Ringe 14 px, überlappend um 4 px, 2 px weißer Außenrand; Zustände siehe Regel 4; immer mit Text für Screenreader | `Lieferanten.dc.html` |
| Schrittfolge | Ringe 32 bis 36 px mit Linie 2 px dazwischen, Haken oder Ziffer | `L-Ueberblick.dc.html`, `Import.dc.html` |
| Monogramm | Kreis 38 bis 52 px, Outfit 600, Fläche nach Status | `Aufgaben.dc.html` |
| Chip | Pille 12 px / 600, Fläche und Text nach Status | überall |
| Knöpfe | Haupt: Petrol auf Weiß. Zweit: weiß mit Innenrand. Auf Tinte: Mint mit Tinte-Text. Höhe 44, bei Hauptaktion 50 bis 54 | `Lieferanten.dc.html` |
| Schalter | Pillen in Fläche `line-soft`, aktive Pille weiß mit Schatten | `Aufgaben.dc.html` |
| Listenkarte | Karte ohne Innenabstand, Abschnittslabel 13 / 600 ohne Fläche, Zeilen mit Trenner `line-soft` | `Aufgaben.dc.html` |
| Datumskreis | Kreis 56 px, Tag in Outfit 19, Monat 10 mit Sperrung; nächster Termin Tinte mit Mint | `Main.dc.html` |
| Privat | Fläche `line-soft`, Rand 2 px gestrichelt `ring-open`, Schloss, Chip „privat“ | `L-Ueberblick.dc.html` |
| Geteilt | Fläche `mint-soft`, Rand 2 px `mint-line`, Doppelring, Chip „beide Seiten“ | `L-Ueberblick.dc.html` |
| KI-Entwurf | Weiß, Rand 2 px gestrichelt Petrol, Zeile „Entwurf von Reziproq“ mit Doppelring, Quellen als graue Pillen, Übernehmen / Anpassen / Verwerfen | `WG-Markt.dc.html` |
| Leitfragen | Fläche `mint-soft` mit Innenrand `mint-line`, Fragen mit Petrol-Ring und Ziffer | `WG-Intern.dc.html` |
| Analyse-Seite | Links Ergebnis (2 Teile), rechts Leitfragen und Beobachtung (1 Teil); auf schmalen Bildschirmen untereinander | `WG-Lieferanten.dc.html` |
| Tabelle | Kopf 12 / 600 `muted`, Zeilentrenner `line-soft`, scrollt waagerecht in ihrem Rahmen | `P-Scorecard.dc.html` |
| Zeitachse | Balken voll gerundet; läuft Petrol, geplant `mint-soft` mit `mint-line`, fertig `line`; Meilenstein als Mint-Kreis mit Tinte-Rand | `P-Initiativen.dc.html` |
| Balken | Höhe 10 px, voll gerundet, Spur `line-soft`, Füllung Petrol | `WG-Intern.dc.html` |
| Aussagen-Kopf | Zeile „Zusammengefasst von Reziproq“ mit Doppelring, Satz in Outfit 40 / 1,12, darunter zwei bis drei Sätze in 18 px und Quellen | `Uebersicht.dc.html` |
| Ringpaar | siehe Abschnitt Ringe, weiße Karte mit 32 px Ecken, rechts Zahlen in Outfit 60 | `Uebersicht.dc.html` |
| Zeilenliste | Karte ohne Innenabstand, Zeilen 72 px: Titel und Unterzeile links, Wert in Outfit 21 rechts, Pfeil | `Uebersicht.dc.html` |
| Fragevorschläge | „Mehr wissen? Frag Reziproq“, darunter Pillen mit Innenrand `mint-line` | `Uebersicht.dc.html` |
| Diagrammkarte | Karte mit Aussage als Titel (Outfit 20), Diagramm, Quelle in 12 px | `D-Diagramme.dc.html` |

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

Tabellen mit vielen Zeilen gehören auf Arbeitsseiten, nicht auf Übersichten.

Aussagen:
- Aussagen schlägt Reziproq vor. Sie tragen die Zeile „Zusammengefasst von Reziproq“ und Quellen als graue Pillen.
- Jede Zahl im Satz muss im Beleg stehen, sonst wird der Satz nicht angezeigt.
- Ohne belastbare Aussage zeigt die Ansicht nur den Beleg, nie einen Platzhalter.

Unter dem Beleg stehen drei vorgeschlagene Fragen als Pillen („Mehr wissen? Frag Reziproq“). So erreicht der Einkäufer die dritte Schicht, ohne dass die Seite voller wird.

## Ringe

Die Ringe kommen aus dem Logo: zwei Kreise, eine gemeinsame Sache.

| Variante | Maße | Einsatz |
|---|---|---|
| Ringpaar | 220 bis 240 px; außen Radius 104, innen 74, Strich 22, Enden rund, Spur `track` | Übersicht: außen Ergebnisse gegen Jahresziel (Petrol), innen Beziehungen, also Fokuslieferanten mit gemeinsamem Plan (Mint) |
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
- Seiten funktionieren auf Telefonbreite: Leisten brechen um, Tabellen scrollen im Rahmen, die Seite selbst nie seitwärts.

## Stand der Vorlagen

Im neuen Design liegen vor: Übersicht, Mein Tag, Diagramme, Kopfleiste, Lieferanten-Leiste, Warengruppen-Leiste, Ablauf-Leiste, Start, Alle Aufgaben, Lieferanten, Import, Fragen, Lieferanten-Überblick, die sechs Seiten des gemeinsamen Plans, die elf Seiten der Warengruppenstrategie und „Warengruppen zusammengeführt“. Für alle anderen Seiten gibt es keine eigene Vorlage; dort gelten die Regeln und Bausteine dieses Dokuments.
