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
| Wirkung | Impact | nav.impact, workspace.areas.impact |
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

## Warengruppenmanagement (Release 1.1, noch nicht umgesetzt)

Aus `docs/reziproq-specs-warengruppen/ergaenzung-glossar.md`, im Wortlaut. Bewusst als Liste und
nicht in der Tabelle oben: Die Tabelle prüft ein Test an Schlüsseln der Oberfläche, und diese
Begriffe haben noch keine Texte in der App. Englisch und Schlüssel kommen mit der Umsetzung
(docs/umsetzungsplan.md, Abschnitt 9). Für „Warengruppe“ gilt in der Tabelle weiter die Zeile oben.

- **Warengruppe:** Vom Kunden angelegte Gruppe von Bauteilen oder Leistungen. Die Bezeichnung ist je Kunde einstellbar, zum Beispiel „Werkstoffgruppe“.
- **Produktgruppe:** Untergliederung einer Warengruppe.
- **Warengruppenstrategie:** Jährlich erarbeitetes und freigegebenes Ergebnis des Ablaufs in zehn Schritten, mit Version und Stand.
- **Lead:** Einkäufer, der das Team der Warengruppe koordiniert und die Strategie verantwortet.
- **Commodity Manager:** Optionale Rolle für strategisch relevante Warengruppen. Bringt die Leitungssicht ein.
- **Sicht:** Teil einer Analyse, zum Beispiel Volumen oder Qualität.
- **Beobachtung:** Pflichttext je Sicht: was auffällt und was es für die Strategie heißt.
- **Marktkraft:** Eine von sechs Kräften der Marktanalyse, eingeschätzt für heute und in 3 bis 5 Jahren.
- **Profil:** Stärken und Schwächen (intern) sowie Chancen und Risiken (extern) der Warengruppe.
- **Paarung:** Verbindung aus einer Stärke oder Schwäche und einer Chance oder einem Risiko.
- **Hebel:** Eintrag aus dem Hebelkatalog, mit dem eine Paarung adressiert wird.
- **Initiative der Warengruppe:** Private Initiative aus der Scorecard der Warengruppe. Nicht die geteilte Initiative einer Beziehung.
- **Segment Ist:** Entscheidung aus der Bewertungsrunde, je Warengruppe oder gesamt je Lieferant.
- **Segment Soll:** Geplantes Segment in einer Warengruppe, wenn die Strategie wirkt, mit Zieljahr.
- **Supplier Map:** Tabelle je Warengruppe mit Umsatzanteil und Segment in Ist und Soll sowie Beziehung je Lieferant.
- **Zusammenführung:** Seite je Lieferant, die alle Warengruppen des Lieferanten zeigt und daraus das Gesamtsegment vorschlägt.
- **Widerspruch:** Lage, in der Warengruppen denselben Lieferanten gegensätzlich planen.
- **Übergabe:** Verweis von einem Element einer freigegebenen Strategie in den Lieferantenplan.
- **Entwurf:** Von der KI erzeugter Inhalt, der noch nicht bestätigt ist.
- **Freigabeweg:** Wer eine Strategie freigibt, abhängig von Umsatz und Relevanz der Warengruppe.
