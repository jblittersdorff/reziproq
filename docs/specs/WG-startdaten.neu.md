# WG Startdaten

Startbestand für jeden neuen Kunden. Wird beim Anlegen des Kunden als Zeilen dieses Kunden kopiert (WG-01) und ist danach je Kunde änderbar. Gehört als Seed-Daten ins Repository, nicht als Konstanten in den Code.

## Kennzahlen (`category_kpi`)

| Dimension | Kennzahl | Beschreibung |
|---|---|---|
| Lieferkette | Bestätigte Kapazität | Anteil bestätigter Kapazität für Anlauf und Serie in der Lieferantenbasis |
| Lieferkette | Logistik-Bewertung | Verlässlichkeit der Logistik der Lieferantenbasis |
| Qualität | Umsatzanteil mit bester Bewertung | Umsatzgewichteter Anteil der Lieferanten, die den Qualitätsstandard erfüllen |
| Qualität | Fehlerquote | ppm, umsatzgewichtet, im Wareneingang und in der Fertigung |
| Kosten | Jährliche Preisverbesserung | Verbesserung des Teilepreises über die Laufzeit |
| Kosten | Abweichung zur Soll-Kalkulation | Abstand des Einkaufspreises zur Soll-Kalkulation |
| Technologie | Innovationsprojekte | Zahl der Innovationsprojekte in der Warengruppe |
| Technologie | Anteil vom Lieferanten angestoßen | Anteil der vom Lieferanten angestoßenen Innovationsprojekte |
| Nachhaltigkeit | Umsatzanteil mit bestandener Bewertung | Umsatzgewichteter Anteil der Lieferanten, die den Nachhaltigkeitsstandard erfüllen |
| Nachhaltigkeit | CO₂-Fußabdruck | Fußabdruck der Warengruppe |

## Kostenarten

Prozess, Material, Logistik, Gemeinkosten, Werkzeug. Weitere mit Begründung.

## Zeithorizonte

Kurzfristig 1 Jahr, mittelfristig 2 bis 3 Jahre, langfristig 4 bis 5 Jahre.

## Leitfragen (`category_question`)

### Schritt 1 Aufsetzen

1. Wer kauft welche Produktgruppe, in welcher Business Unit und Region?
2. Wer koordiniert als Lead?
3. Ist die Warengruppe so relevant, dass sie einen Commodity Manager braucht?
4. Worin gleichen und unterscheiden sich die Produktgruppen zwischen den Business Units?

### Schritt 2 Ziele

1. Welche übergeordnete Strategie gilt? Immer die nächsthöhere ansehen.
2. Welche der fünf Dimensionen spricht sie an?
3. Welche davon sind für diese Warengruppe relevant, und warum?
4. Was bedeutet jedes übergeordnete Ziel für die Warengruppe?
5. Welche Dimension stellt ihr zurück, und mit welcher Begründung?

### Schritt 3 Interne Analyse

**Volumen**

1. Welche Produktgruppen machen den größten Umsatz aus?
2. Dominieren wenige, oder verteilt sich der Umsatz gleichmäßig?
3. Welche Business Unit hat den größten Anteil, und stellt sie besondere Anforderungen?
4. Welche Teile unterscheiden euch im Wettbewerb und brauchen besonderes Augenmerk?
5. Welche Mindestanforderungen müssen alle Teile erfüllen?

**Lieferkette**

1. Ist die Lieferkette vollständig bekannt, und wie ist sie aufgebaut?
2. Macht die Zahl der Stufen sie anfällig?
3. Gibt es Technik oder Material nur in bestimmten Regionen?
4. Auf welchen Stufen entsteht die meiste Wertschöpfung?
5. Ist der Footprint ausgewogen oder von einzelnen Ländern abhängig?
6. Gibt es lange Transportwege oder eine regionale Bündelung mehrerer Stufen?
7. Welche Länder sind besonders wichtig, und ergeben sich daraus geopolitische Risiken?

**Kosten**

1. Welche Kosten dominieren die Kostenstruktur?
2. Was sind die Ursachen je Kostenart?
3. Wie weichen die Soll-Kosten von den Ist-Kosten ab?
4. Welche Kostenarten weichen am stärksten ab, und warum?
5. Wie teuer kauft der Wettbewerb ein?
6. Wo spart der Wettbewerb, und warum?
7. Wie viel Einsparung ist möglich, und wodurch?

**Technologie**

1. Welche Technologien sind geplant oder könnten relevant werden?
2. Kann die heutige Lieferantenbasis die Roadmap abbilden?
3. Kommen neue Technologien von Lieferanten oder sind sie auf wenige beschränkt?
4. In welchem Volumen und Tempo laufen sie an?

### Schritt 4 Lieferantenanalyse

**Umsatz und Finanzen**

1. Ist die Basis breit aufgestellt oder von wenigen Lieferanten abhängig?
2. Wie verschiebt sich der Umsatz in 3 bis 5 Jahren: Bündelung oder Zersplitterung?
3. Passen Verträge und Abrufe zusammen? Reichen weniger Lieferanten, oder braucht ihr mehr?
4. Gefährdet die finanzielle Lage eines Lieferanten eure Ziele?

**Qualität**

1. Verursacht die Basis insgesamt Qualitätsprobleme oder einzelne Lieferanten?
2. Welchen Umsatzanteil haben Lieferanten mit schwächerer Bewertung, und ist das ein Risiko?
3. Gibt es negative Entwicklungen bei Audits, die die Strategie aufgreifen muss?
4. Gefährdet die Qualität der Lieferanten eure Ziele?

**Footprint**

1. In welchen Ländern ist die Basis stark oder schwach vertreten, mit welchen Risiken und Chancen?
2. Woher kommen und wohin fließen die Warenströme? Gibt es riskante Kombinationen?
3. Welche Lieferanten sind noch nicht Teil der Basis, wären aber wertvoll?
4. Wer bietet die Warengruppe noch nicht an, will aber dazukommen?

### Schritt 5 Marktanalyse

**Verhandlungsmacht der Lieferanten**

1. Wie viele alternative Lieferanten gibt es?
2. Wie spezialisiert sind sie, und wie groß ist ihr Anteil an der Wertschöpfung?
3. Wie teuer ist ein Wechsel für euch?

**Verhandlungsmacht der Endkunden**

1. Welche Kundengruppen kaufen Produkte mit dieser Warengruppe, und wie wichtig ist sie ihnen?
2. Gibt es Alternativen für die Kunden, und was kostet sie der Wechsel?
3. Wie empfindlich reagieren sie auf Preisänderungen?

**Bedrohung durch neue Konkurrenz**

1. Wie hoch sind die Eintrittsbarrieren (Kapital, Wissen, Lizenzen, Regulierung)?
2. Haben etablierte Anbieter Größenvorteile?
3. Wie leicht ist der Zugang zu Kunden und Märkten?

**Bedrohung durch Ersatzprodukte**

1. Gibt es Ersatz, der dieselbe Funktion erfüllt?
2. Wie ist dessen Preis-Leistungs-Verhältnis?
3. Wie hoch ist der Wechselaufwand, wie treu sind die Abnehmer?

**Abhängigkeit von externen Faktoren**

1. Von welchen externen Faktoren hängt die Warengruppe ab (Technik, Material)?
2. Gibt es starken Wettbewerb um diese Faktoren?
3. Welche Gesetze beeinflussen die Warengruppe maßgeblich?

**Wettbewerb im Markt**

1. Wächst der Markt, oder kämpfen viele ähnliche Anbieter um dieselben Kunden?
2. Worin unterscheiden sich eure Produkte von denen der Wettbewerber?
3. Wie hoch sind Kapital- und Fixkosten im Markt?
4. Welche Lieferanten nutzen Wettbewerber, und warum?

**Zusammenschau**

1. Welche Kraft oder Kombination ist heute oder künftig ein Risiko, das die Strategie abfedern muss?
2. Wo könnt ihr das Kräfteverhältnis nutzen, um eure Ziele zu erreichen, und wie?

### Schritt 6 Bewertung

1. Mit welchem Hebel nutzt ihr eine Stärke, um ein Risiko abzufedern?
2. Mit welchem Hebel macht ihr aus Stärke und Chance einen Vorteil?
3. Welcher Hebel verhindert, dass Schwäche und Risiko zusammen eintreten?
4. Welcher Hebel gleicht eine Schwäche aus, damit ihr eine Chance nutzen könnt?

### Schritt 7 Scorecard

1. Auf welches Ziel der Warengruppe zahlt die Initiative ein?
2. Was muss geschehen, damit der Hebel umgesetzt ist?
3. Wer treibt die Initiative und verantwortet die Umsetzung?

### Schritt 8 Vergaben

1. Wie muss die Vergabe laufen, damit sie die Ziele der Warengruppe stützt?
2. Welche Lieferanten sind geeignet, und warum?
3. Wie groß ist das Volumen, und was verändert die Vergabe an Lieferantenbasis und Footprint?

**Prüffragen zur Eignung eines Lieferanten**

| Dimension | Fragen |
|---|---|
| Lieferkette | In wie vielen Ländern produziert er, und welche Standorte kommen in Frage? Wie zuverlässig hat er in Anlauf und Serie geliefert, und kennt er die Warengruppe? Welchen Umsatzanteil hätte er nach der Vergabe, entsteht ein Klumpenrisiko? |
| Qualität | Welches Auditergebnis hat er, und wie hat es sich in drei Jahren entwickelt? Wie liegt seine Fehlerquote zum Durchschnitt der Warengruppe? |
| Kosten | Wie liegt der gebotene Preis zum Zielpreis der Soll-Kalkulation? Wie liegt er zum Durchschnitt der Warengruppe? Wie offen legt er Material-, Prozess- und Gemeinkosten? |
| Technologie | Wie viele Patente hält er im Verhältnis zum Umsatz? Welche Neuerungen hat er in drei Jahren in Serie gebracht? Wie viele seiner Produkte gelten im Vergleich als führend? |
| Nachhaltigkeit | Wie ist seine Nachhaltigkeitsbewertung, und wie entwickelt sie sich? Wie hoch ist sein CO₂-Fußabdruck je Einheit? Welchen Rezyklatanteil kann er umsetzen? |

### Schritt 9 Supplier Map

1. In welchem Segment steht der Lieferant heute, und welches strebt ihr an?
2. Wie verteilt sich der Umsatz heute, welche Verteilung wollt ihr, und bis wann?
3. Gibt es regelmäßige Termine und einen aktiven Austausch?
4. Wie offen werden Informationen geteilt?
5. Gibt es ungelöste Konflikte, und wie werden sie gelöst?
6. Werden Zusagen verbindlich eingehalten?

### Schritt 10 Freigabe

1. Wie lässt sich die Ausgangslage knapp zusammenfassen?
2. Welche Ziele gelten, und wie werden sie gemessen?
3. Welche Hebel sind entscheidend, und mit welchen Initiativen werden sie umgesetzt?
4. In welchen Segmenten stehen die wichtigsten Lieferanten heute und künftig?
5. Was hat sich seit der letzten Vorlage geändert?

## Hebelkatalog (`lever`)

Die Spalte `dimensions` ist noch zu füllen: Welche Zieldimensionen jeder Hebel beeinflusst, steht noch aus.

| Hebel | Beschreibung |
|---|---|
| Wertschöpfungskette durchleuchten | Die gesamte Kette transparent machen, Kostentreiber finden, Maßnahmen ableiten |
| Wertschöpfungskette neu gestalten | Anteile von Eigenfertigung und Zukauf verändern, um Effizienz zu steigern oder Risiko zu senken |
| Neue Produktionstechnologien einführen | Andere Fertigungsverfahren einsetzen |
| Materialeinsatz reduzieren oder ändern | Teure Materialien ersetzen oder verringern, für Kosten oder Nachhaltigkeit |
| Anforderungen auf Marktstandard begrenzen | Spezifikationen auf gängige Standards zurückführen, um Komplexität und Kosten zu senken |
| Effizienzprogramme beim Lieferanten | Gemeinsam Prozesse und Produktivität beim Lieferanten verbessern |
| Lieferanten integrieren | Rückwärtsintegration durch Übernahme |
| Neue Lieferanten einführen | Neue Anbieter zusätzlich oder als Ersatz aufnehmen |
| Wettbewerbsrelevante Informationen austauschen | Technologien, Bedarfe, Prognosen und Marktanforderungen offen teilen |
| Volumen bei weniger Lieferanten bündeln | Zahl der Lieferanten senken, Größenvorteile nutzen |
| Bedarfe bündeln | Bedarfe über Standorte, Business Units oder Regionen zusammenfassen |
| Volumen in der bestehenden Basis umverteilen | Anteile zwischen vorhandenen Lieferanten verschieben |
| Preise verhandeln | Preise nach Markt-, Mengen- oder Leistungskriterien anpassen |
| Second-Level Buying | Unterbaugruppen oder Rohmaterial direkt einkaufen, um kritische Stufen zu umgehen |
| Verbands- und Interessenarbeit verstärken | Auf Regeln und Standards einwirken |
| Mehr aus Niedrigkostenländern beziehen | Volumen in günstigere Regionen verlagern |
| Lieferkettenkosten senken | Zölle, Routen, Verpackung und Verwaltung optimieren |
| Verträge erweitern | Flexible Vertragsmodelle wie Rahmenverträge für Preise, Mengen, Bedingungen |
| Gain-Sharing | Lieferanten an Einsparungen aus ihren Verbesserungen beteiligen |
| Zahlungsziele anpassen | Fristen verlängern oder verkürzen, um Liquidität zu steuern |
| Preismodelle erweitern | Zum Beispiel Preisgleitklauseln oder feste Marge |
| Gezielter Kauf außerhalb der regulären Kanäle | Regelkonform alternative Wege nutzen, kurzfristig für Kosten oder Versorgung |
| Kollaboration oder Joint Venture | Partnerschaft oder gemeinsames Unternehmen, etwa für Technologieentwicklung |

## Beziehung

Keine eigenen Werte. Die Beziehungsqualität ist Teil des Segments aus SEG (Business Impact × Beziehungsqualität).
