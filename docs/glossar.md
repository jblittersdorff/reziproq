# Glossar

Fachbegriffe in Deutsch und Englisch (PLT-09). Sie gelten für alle Texte in `apps/web/src/locales/de.ts` und `en.ts`. Wer neue Texte schreibt, nimmt die Begriffe von hier und übersetzt sie nicht neu.

Die Spalte „Schlüssel“ nennt Stellen, an denen der Begriff vorkommt. Ein Test (`apps/web/src/locales/glossary.test.ts`) prüft dort: Der deutsche Text enthält den deutschen Begriff, der englische den englischen. Groß- und Kleinschreibung zählen dabei nicht. `styleguide:` steht für die Texte des Styleguides. „–“ heißt, dass die App den Begriff noch nicht verwendet.

| Deutsch | Englisch | Schlüssel |
|---|---|---|
| Lieferant | Supplier | nav.suppliers, workspace.label, workspace.pages.supplierPlan.title |
| Beziehung | Relationship | workspace.areas.relationship, team.noSro |
| Beziehungspuls | Relationship Pulse | – |
| Warengruppe | Category | styleguide:forms.commodity, styleguide:table.commodity |
| Business Unit | Business Unit | – |
| SRO | SRO | team.roles.sro, workspace.head.sro |
| JBP | JBP | – |
| QBR | QBR | – |
| GuV-Wirkung | P&L impact | settings.controllingHint |
| Maßnahme | Action | workspace.pages.actions.title |
| Zusage | Commitment | workspace.pages.commitments.title |
| Gemeinsamer Plan | Joint Business Plan | workspace.areas.plan |
| Spielregeln | Rules of engagement | workspace.pages.rules.title |
| Ergebnisse | Results | nav.impact, workspace.areas.impact, workspace.tabs.results |
| Aktivitäten | Activities | workspace.tabs.activities, activities.title |
| Segment | Segment | workspace.head.segment |
| Segmentierung | Segmentation | workspace.pages.segmentation.title |
| Sponsor | Sponsor | team.roles.sponsor |
| Kontaktpunkt | Touchpoint | workspace.pages.touchpoints.title |
| Umsetzung | Execution | workspace.areas.execution |
| Spend | Spend | workspace.pages.spend.title |
| Initiative | Initiative | workspace.pages.initiatives.title |
| Termin | Meeting | workspace.pages.meetings.title |
| Lieferantenplan | Supplier plan | workspace.pages.supplierPlan.title |
| Verlauf | History | audit.title |
| Intern | Internal | workspace.internal |
| Betreiber | Operator | profile.operator |
| Controlling | Controlling | roles.controlling |
| Portfolio | Portfolio | nav.portfolio |
| Strategie | Strategy | workspace.areas.strategy |
| Hinweis | Hint | workspace.areas.hints |
| Scorecard | Scorecard | workspace.pages.scorecard.title |

Im Produktkonzept heißt die GuV-Wirkung auch „P&L-Impact“. In der Oberfläche steht „GuV-Wirkung“, wie in CLAUDE.md.

## Begriffe für die geplante Oberfläche

Die Tabelle oben dokumentiert die heutigen Übersetzungsschlüssel. Die Hauptnavigation für Käufer lautet Übersicht, Mein Tag, Lieferanten, Warengruppen. Das fachliche Maß GuV-Wirkung bleibt erhalten.

- **Übersicht** — Hauptpunkt mit den Ergebnissen des ganzen Programms. Startseite für Lead und Admin.
- **Mein Tag** — Hauptpunkt mit allem, was die Person heute tun muss. Ersetzt Start. Startseite für alle anderen Käufer.
- **Ergebnisse** — In der Oberfläche der neue Name für Wirkung: gesicherter Wert, Wertpotenziale, Feedback.
- **Aktivitäten** — Verlauf je Lieferant aus Terminen, Notizen, Mails, Transkripten, Dateien, Hinweisen und Einträgen von Reziproq.
- **Von Reziproq vorbereitet** — Block in Mein Tag mit offenen Entwürfen der Agenten für die Person.
- **Aussage** — Satz von Reziproq oben auf einer Auswertung, nur aus belegten Fakten. Ohne Beleg wird er nicht angezeigt.
- **Beleg** — Ringpaar oder Diagramm, das die Aussage beweist.
- **Fakten-Baukasten** — Code je Seite, der die Zahlen für Aussage und Beleg mit den Rechten der Person liest.
- **Ziel des Lieferanten** — EBIT-Ziel je Jahr und Beziehung, vom SRO vorgeschlagen, vom Lead freigegeben.

## Warengruppen und Segmente

- **Warengruppe** — Vom Kunden angelegte Gruppe von Bauteilen oder Leistungen. Die Bezeichnung ist je Kunde einstellbar, zum Beispiel „Werkstoffgruppe“.
- **Produktgruppe** — Untergliederung einer Warengruppe.
- **Warengruppenstrategie** — Jährlich erarbeitetes und freigegebenes Ergebnis des Ablaufs in zehn Schritten, mit Version und Stand.
- **Lead** — Einkäufer, der das Team der Warengruppe koordiniert und die Strategie verantwortet.
- **Commodity Manager** — Optionale Rolle für strategisch relevante Warengruppen. Bringt die Leitungssicht ein.
- **Sicht** — Teil einer Analyse, zum Beispiel Volumen oder Qualität.
- **Beobachtung** — Pflichttext je Sicht: was auffällt und was es für die Strategie heißt.
- **Marktkraft** — Eine von sechs Kräften der Marktanalyse, eingeschätzt für heute und in 3 bis 5 Jahren.
- **Profil** — Stärken und Schwächen (intern) sowie Chancen und Risiken (extern) der Warengruppe.
- **Paarung** — Verbindung aus einer Stärke oder Schwäche und einer Chance oder einem Risiko.
- **Hebel** — Eintrag aus dem Hebelkatalog, mit dem eine Paarung adressiert wird.
- **Initiative der Warengruppe** — Private Initiative aus der Scorecard der Warengruppe. Nicht die geteilte Initiative einer Beziehung.
- **Segment Ist** — Entscheidung aus der Bewertungsrunde, je Warengruppe oder gesamt je Lieferant.
- **Soll-Typ (Warengruppe)** — Geplantes Segment in einer Warengruppe, wenn die Strategie wirkt, mit Zieljahr. Dieselben Segmente wie der Soll-Typ in SEG.
- **Supplier Map** — Tabelle je Warengruppe mit Umsatzanteil, Segment Ist und Soll-Typ je Lieferant.
- **Zusammenführung** — Seite je Lieferant, die alle Warengruppen des Lieferanten zeigt und daraus das Gesamtsegment vorschlägt.
- **Widerspruch** — Lage, in der Warengruppen denselben Lieferanten gegensätzlich planen.
- **Übergabe** — Verweis von einem Element einer freigegebenen Strategie in den Lieferantenplan.
- **Freigabeweg** — Wer eine Strategie freigibt, abhängig von Umsatz und Relevanz der Warengruppe.
- **Segment** — Business Impact (Hoher, Mittlerer oder Niedriger Impact) und Beziehungsqualität (schwach, ausbaufähig oder stark), etwa „Hoher Impact · ausbaufähig“. Der Soll-Typ verwendet dieselbe Matrix. Die Supplier Map führt kein eigenes Beziehungsfeld.

## KI und Agenten

- **Gateway** — Modul, über das jeder Modellaufruf läuft. Erzwingt die EU, wählt das Modell, misst Kosten.
- **Modellklasse** — `small`, `standard` oder `synthesis`. Der Code wählt die Klasse, das Gateway das Modell.
- **Agent** — Gespeicherte Anleitung aus Aufgabe, Werkzeugen, Auslöser, Ergebnis und Budget. Von Reziproq oder vom Kunden.
- **Lauf** — Eine Ausführung eines Agenten mit gespeicherten Schritten, Quellen und Kosten.
- **Testlauf** — Lauf mit echten Daten, der keine Entwürfe anlegt. Voraussetzung zum Aktivieren eines eigenen Agenten.
- **Werkzeug** — Lesender Zugriff eines Agenten auf einen Datenbereich, mit den Rechten der Person, in deren Namen der Lauf handelt.
- **Entwurf** — Von der KI erzeugter Inhalt, der erst nach Übernahme durch einen Menschen zählt.
- **Quelle** — Beleg einer Aussage: eigene Daten mit Verweis auf das Objekt oder öffentliche Quelle mit Adresse und Datum.
- **Dünn belegt** — Aussage mit nur einer öffentlichen Quelle oder mit Quellen älter als zwölf Monate.
- **Kontingent** — Budget für Läufe und Kosten je Monat und Kunde.
- **Wertpotenzial** — Vom Wertpotenzial-Finder beziffertes gemeinsames Potenzial mit einem Lieferanten, mit Spanne für beide Seiten, Wirkungsart und Sicherheit.
- **Hebel-Vorlage** — Versionierte Formel im Code, nach der ein Wertpotenzial gerechnet wird.
- **Sicherheit** — Wie belastbar ein Potenzial oder ein Schritt ist: hoch, mittel, niedrig, nach fester Regel aus der Herkunft der Eingaben.
- **Marktsignal** — Datierte Beobachtung aus öffentlichen Quellen zu Rohstoffen, Marktkapazität, Lieferant, Zöllen oder Technologie, die der Wertpotenzial-Finder einem Ergebnis zuordnet.
- **Datenlücke** — Fehlende Eingabe, ohne die eine Hebel-Vorlage nicht prüfbar ist.
- **Frage an das Team** — Leitfrage, die der Strategie-Autor aus Daten nicht beantworten kann und an eine Person oder Rolle stellt.

## Anbindungen

- **Anbindung** — Verbindung von Reziproq zu einem System des Kunden (Microsoft 365, Google Workspace, Import-API …). Technisch: `connection`.
- **Eingangsadresse** — `termine@<kunde>.reziproq.de` und `notizen@<kunde>.reziproq.de`. Einladungen und weitergeleitete Mails landen darüber in Reziproq.
- **Outlook-Add-in** — Erweiterung in Outlook. Speichert Termine als Aktivität und legt Mails beim Lieferanten ab.
- **Neu eingegangen** — Liste in Mein Tag mit Terminen und Mails, die Reziproq nicht eindeutig zuordnen konnte.
- **Transkript** — Text einer Besprechung aus Teams, Meet oder Upload. Nie Audio oder Video. Rohtext wird nach der Aufbewahrungsfrist gelöscht.
- **Betriebsvereinbarung** — Bestätigung des Kunden, dass die Übernahme von Transkripten mit dem Betriebsrat geregelt ist. Voraussetzung für Transkripte.
- **Datenmodell Einkauf** — Einheitliche Objektarten für Datei-Import und Import-API: Lieferant, Warengruppen-Zuordnung, Spend, Bestellzeile, Wareneingang, Gutschrift, Vertrag, Qualitätsmeldung.
