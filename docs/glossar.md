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
