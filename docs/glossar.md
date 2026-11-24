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

## Umbau KI-nativ (Kapitel 1 bis 8)

Ergänzung aus dem Spec-Paket vom 24.11.2026. Wo ein Begriff in diesem Glossar schon steht, auch in den älteren Abschnitten unten, gilt diese Fassung. Die Tabelle oben mit den Schlüsseln beschreibt die heutigen Texte der App und ändert sich erst mit dem Umbau.

- **Heute** — Startseite der Arbeit: bis zu drei Fokus-Themen, Kurz prüfen, Erledigt, „Diese Woche“. Ersetzt Mein Tag.
- **Fokus-Thema** — Ein Thema, das eine Entscheidung, Freigabe oder ein Gespräch eines Menschen braucht (`focus_item.level = focus`).
- **Fokus-Mappe (Mappe)** — Vorbereitete Entscheidung in fünf Teilen: worum es geht, Belege, Optionen mit Wert für beide Seiten, Empfehlung, dein Schritt.
- **Kurz prüfen** — Stapel der offenen Entwürfe von Reziproq; ein Klick je Entwurf: Übernehmen, Anpassen, Verwerfen (mit Grund), Später.
- **Erledigt** — Protokoll dessen, was Reziproq selbst getan hat; jede Zeile mit Zurücknehmen oder Warum.
- **Warum** — Herleitung einer Aussage oder Zahl: Rechenweg, Quellen, Lauf.
- **Mein Agent** — Einstellung je Person: wie viel Reziproq je Aufgabe selbst tut.
- **Stufe** — Vorschlagen (Hinweis mit Begründung), Vorbereiten (Entwurf in Kurz prüfen), Erledigen (Reziproq handelt und meldet in Erledigt). Code: `suggest`, `prepare`, `do`.
- **Aufgabe von Reziproq** — Ein Worker aus der Registry (früher „Agent“), z. B. Postfach, Termin-Briefing, Wertfinder.
- **Bindend** — Handlung, die gegenüber anderen gilt (Zusage im Namen des Käufers, Freigabe, Wertbestätigung, Teilen in die Mitte, Deal senden oder bestätigen, Mandat ändern). Nur mit Bestätigungs-Token eines Menschen.
- **Beziehung** — Wurzelobjekt zwischen Käufer und Lieferant; alles trägt `relationship_id`. Ersetzt „Lieferant“ in der Navigation.
- **Akte** — Die Seite einer Beziehung mit drei Sichten: Gemeinsam, Nur für dich, Von <Gegenüber>.
- **Die Mitte** — Alles in `space = shared`: beide Seiten sehen es gleich.
- **Spiegel** — Darstellung beider Seiten nebeneinander: links die eigene Seite (Tinte), rechts das Gegenüber (Petrol), Naht in Mint.
- **Zusage** — Verbindliche Ankündigung einer Seite mit Frist und Messung; ersetzt die geteilte Maßnahme. Interne Maßnahmen heißen Aufgabe.
- **Zusagequote** — Gehaltene Zusagen einer Seite im Jahr, je Beziehung, Beleg je Buchung.
- **Mandat** — Rahmen je Beziehung: Ziel, Grenzen, was Reziproq selbst tun darf. Nur für die Käuferseite.
- **Termin** — Objekt mit drei Phasen: Vorbereiten, Im Termin, Danach.
- **Beitrag** — Zulieferung einer Person zu einem Agendapunkt; per Link ohne Konto möglich.
- **Wert** — Ersetzt „Wirkung“ und „Ergebnisse“ in der Oberfläche.
- **Wertart** — EBIT, Kostenvermeidung, Cash. Werden nie addiert.
- **Wert-Engine** — Deterministische Berechnung aus Rechenregel, eingefrorener Baseline und Importwerten.
- **Reife R1 bis R5** — Idee, Bewertet, Beschlossen, Umgesetzt, Realisiert. R5 vergibt das Controlling.
- **Wertkonto** — Gebuchter, geprüfter und möglicher Wert je Beziehung, getrennt nach Wertart.
- **Wertfinder** — Sucht Hebel mit Wert für beide Seiten (früher Wertpotenzial-Finder).
- **Reibung** — Ereignis, das dem Gegenüber Kosten verursacht (z. B. Eilabruf), mit geschätzten Kosten.
- **Beziehungsrendite** — EBIT je Stunde gemeinsamer Arbeit einer Beziehung; nur Summen, standardmäßig aus (E-K4-2).
- **Deal** — Vereinbarung zweier Seiten über einen Tausch (z. B. Prognose gegen Preis), mit Fassungen, Verlauf und Folgen.
- **Kostenspanne** — Freiwillig geteilte Spanne eigener Kosten des Lieferanten, ohne Herleitung.
- **Kennzeichnung** — Angabe an jeder Nachricht in der Mitte: Mensch, mit Reziproq, Reziproq.
- **Verdiente Autonomie** — Reziproq bietet eine höhere Stufe an, wenn Entwürfe über Zeit unverändert übernommen wurden; ein Fehler setzt zurück.
- **Simulator** — Spielt im Demo-Mandanten den Lieferanten nach Drehbuch.
- **Strategie** — Versionierte Warengruppenstrategie in vier Teilen: Rahmen und Ziele, Lage, Richtung, Umsetzung.
- **Mandat-Vorschlag** — Aus einer freigegebenen Strategie abgeleitete Änderung eines Mandats; gilt erst nach Bestätigung.
- **Marktsignal** — Preis-, Rohstoff- oder Kapazitätsänderung aus öffentlichen Quellen, auf Beziehungen abgebildet.
- **Kanal** — Ort außerhalb von Reziproq: Mail, Kalender, Chat, Sprache.
- **Demo-Regie** — Verborgene Leiste im Demo-Mandanten (⌥D) für Szenarien, Signale, Zeit, Rolle, Gegenüber, KI-Modus.
- **Hypothese** — Ein Hebel der Strategie als prüfbare Behauptung mit Wert, Sicherheit und Annahmen (ab Kapitel 8).
- **Annahme** — Prüfbare Bedingung einer Hypothese mit Prüfregel, Quelle und Frist; Stand im Plan, offen oder verletzt.
- **Sicherheit** — Hoch, mittel oder niedrig; setzt der Code aus dem Stand der Annahmen; Reziproq senkt sie selbst, hebt sie nie ohne Bestätigung.
- **Zielwächter** — Täglicher Abgleich jedes Strategie-Ziels mit seinem Planpfad: im Plan, gefährdet, offen.
- **Wert-Pipeline** — Wert einer Strategie je Wertart in vier Stufen: Potenzial, beschlossen, umgesetzt, gesichert.
- **Soll-Kosten** — Was ein Teil kosten sollte, gerechnet aus Stückliste, Indizes und Prozessmodell; nur für die Käuferseite.
- **Einzelquelle** — Anteil des Bedarfs, der nur an einer qualifizierten Quelle hängt; Maß für Abhängigkeit.
- **Anteile-Rechner** — Rechnet Anteile je Lieferant unter den Regeln der Strategie durch und zeigt die Optionen, die alle Regeln einhalten.
- **Weitergabe** — Entwürfe, die aus einer Entscheidung für die zuständigen Personen entstehen (Mandat, Lieferantenplan, JBP, Anfrage, Strategie).
- **Vergabe** — Objekt einer Ausschreibung: Shortlist, Anfragen je Akte, Angebote, Verhandlung, Vergabe-Mappe.
- **Verhandlungsrahmen** — Vom Menschen freigegebenes Ziel, Argumente und Grenzen, in denen der Agent unverbindlich verhandeln darf; nur Käuferseite.
- **Verhandlung der Agenten** — Unverbindliche Runden zwischen dem Agenten des Käufers und dem des Lieferanten, höchstens drei, nur wenn beide Seiten es zulassen.
- **Review nach Ausnahme** — Vorlage fürs Gremium mit nur Abweichungen und Entscheidungen, 10 Arbeitstage vorher von Reziproq geschrieben.
- **Lead der Beziehung** — Lead der Haupt-Warengruppe einer Beziehung; entscheidet außerhalb des Mandats (E-K5-2, E-K0-07).
- **Vertretung** — Person, die für einen Lead entscheidet, eingestellt unter Einstellungen › Organisation (E-K0-07).
- **Key Account** — Rolle beim Lieferanten, früher `sro` (E-K0-08); daneben Sponsor und Mitglied.
- **Strategisch** — Fokuslieferant (SEG-02); Pflicht zum Mandat und Filter in Beziehungen (E-K0-09).

### Wörter, die in der Oberfläche nicht mehr vorkommen

- Übersicht → Wert
- Mein Tag → Heute
- Lieferanten (Navigation) → Beziehungen
- Agenten → Mein Agent (Person), KI (Einstellungen, Admin)
- Wirkung, Ergebnisse → Wert
- Maßnahme (geteilt) → Zusage
- Maßnahme (intern) → Aufgabe
- Notizraum, Aktivitäten → Verlauf (Akte, Nur für dich)
- Neu eingegangen → Zuordnung als Entwurf in Kurz prüfen
- Wertpotenzial-Finder → Wertfinder
- Wette (für einen Hebel) → Hypothese
- Forecast → Prognose
- Suchen oder fragen → Frag Reziproq
- Quartalsbericht → Wertbericht (monatlich)

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
- **Import** — Hochladen von Lieferantenstamm, Spend, Bestellzeilen oder Gutschriften mit Zuordnung und Prüfung (KI-15).
- **Warteschlange zur Prüfung** — Zeilen eines Imports, die ein Mensch entscheidet, weil die Zuordnung unsicher ist.
- **Alias** — Gelernte Zuordnung einer Lieferantennummer oder Namensvariante zu einem Lieferanten.
- **Frühwarnung** — Erweiterung der Hinweise aus FS-01 um neue Regeln, Beleg, Schwere, Wirkung und nächsten Schritt (KI-16).
- **Wo du handeln musst** — Spalte auf Start mit den wichtigsten offenen Hinweisen.
- **Briefing** — Interne Vorbereitung eines Termins mit Lage, Themen, Risiken, offenen Punkten und Zielen (KI-07).
- **Ergebnisse erfassen** — Auswertung der Notizen eines Termins zu Entwürfen für Zusagen, Maßnahmen, Entscheidungen und Protokoll (KI-17).
- **Fundstelle** — Wörtlicher Auszug mit Seite oder Satz, aus dem ein Wert oder Entwurf stammt.
- **Bestätigtes Feld** — Aus einem Dokument gezogener Wert, den ein Mensch bestätigt oder korrigiert hat. Nur damit wird gerechnet (KI-18).
- **Vertragstreue** — Abgleich der Vertragsbedingungen mit Bestellungen und Gutschriften. Ein Befund ist ein Vertragsleck (KI-19).
- **Szenario** — Vergleich von Optionen für eine Warengruppe oder einen Lieferanten mit Kosten, Abhängigkeit, Risiko und Zeit, ohne Gesamtwert (KI-20).
- **Zielkorridor** — Ausgangswert, Ziel und Grenze einer Verhandlung. Privat (KI-21).
- **Probeverhandlung** — Übung, in der die KI den Lieferanten spielt, ohne Zugriff auf den Zielkorridor.
- **Quartalsbericht** — Eingefrorener Bericht zum SRM eines Quartals, vom Lead freigegeben (KI-22).
- **Hilfe für Lieferanten** — KI-Funktionen auf der Lieferantenseite mit eigener Registry und eigenen Läufen (KI-23).

## Anbindungen

- **Anbindung** — Verbindung von Reziproq zu einem System des Kunden (Microsoft 365, Google Workspace, Import-API …). Technisch: `connection`.
- **Eingangsadresse** — `termine@<kunde>.reziproq.de` und `notizen@<kunde>.reziproq.de`. Einladungen und weitergeleitete Mails landen darüber in Reziproq.
- **Outlook-Add-in** — Erweiterung in Outlook. Speichert Termine als Aktivität und legt Mails beim Lieferanten ab.
- **Neu eingegangen** — Liste in Mein Tag mit Terminen und Mails, die Reziproq nicht eindeutig zuordnen konnte.
- **Transkript** — Text einer Besprechung aus Teams, Meet oder Upload. Nie Audio oder Video. Rohtext wird nach der Aufbewahrungsfrist gelöscht.
- **Betriebsvereinbarung** — Bestätigung des Kunden, dass die Übernahme von Transkripten mit dem Betriebsrat geregelt ist. Voraussetzung für Transkripte.
- **Datenmodell Einkauf** — Einheitliche Objektarten für Datei-Import und Import-API: Lieferant, Warengruppen-Zuordnung, Spend, Bestellzeile, Wareneingang, Gutschrift, Vertrag, Qualitätsmeldung.
