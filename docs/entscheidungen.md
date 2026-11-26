# Entscheidungen zum Umbau (Kapitel 1 bis 8)

Stand 24.11.2026. Jede offene Frage aus der Konzeptarbeit zu Kapitel 1 bis 8 ist hier entschieden; für die Umsetzung gilt diese Datei, nicht die Konzeptunterlagen. Grundlage ist die jeweilige Empfehlung (bestätigt von Jan-Luka am 24.11.). Vier Punkte zu Recht, Kartellrecht und Lizenzen sowie in Kapitel 8 die Reichweite der Vergabe und den Begriff „Hypothese“ hat Jan-Luka einzeln entschieden; sie sind mit **(einzeln entschieden)** markiert. E-K8-3 bis E-K8-7 sind Empfehlungen, die ohne gesonderte Bestätigung übernommen wurden; sie lassen sich wie alle anderen einzeln kippen.

Jede Spec verweist mit der Kennung (z. B. E-K2-4) auf diese Liste. Wer eine Entscheidung kippt, ändert sie hier und in den genannten Specs; die Spalte „Folge, wenn anders“ nennt, was dann nachzuziehen ist.

## Kapitel 1: Rahmen und Heute

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K1-1 | Startseite für Lead und Admin | Wert; alle anderen Käufer starten in Heute | Heute für alle: einfacher, Leads sehen zuerst Arbeit statt Stand | NAV-10 |
| E-K1-2 | Name „Mein Agent“ | bleibt | Alternative „Wie Reziproq für mich arbeitet“ ist zu lang für die Seitenleiste | NAV-10, MA-01 |
| E-K1-3 | Wie viele Fokus-Themen sind sichtbar? | höchstens drei | fünf: mehr Abdeckung, Heute wird wieder eine Liste | HE-01 |
| E-K1-4 | Terminschiene auf Heute | entfällt; rechts „Diese Woche“ mit höchstens drei Einträgen | Schiene bleibt: Heute wird länger | HE-01, NAV-10 |
| E-K1-5 | Darf Reziproq Lieferanten auf Stufe Erledigen an deren bestehende Zusagen erinnern? | ja, nur an Zusagen des Lieferanten, gekennzeichnet als Nachricht von Reziproq | nein: jede Erinnerung geht durch Kurz prüfen | MA-01, AU-01, ZQ-01 |
| E-K1-6 | Was ist im Code schon gebaut? | Claude Code prüft vor K1-a den Stand gegen die Specs und listet Abweichungen, ohne Code zu schreiben (Paket K0) | ohne Prüfung droht doppelte Arbeit | Umsetzungsplan |

## Kapitel 2: Beziehungen und Akte

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K2-1 | Werden geteilte Maßnahmen zu Zusagen? | ja; interne Maßnahmen werden Aufgaben | zwei Objekte, zwei Quoten, Doppelungen | ZQ-01 |
| E-K2-2 | Wie zählt eine ersetzte Zusage? | als verfehlt nur, wenn die alte Frist vor dem Ersatz verstrichen war | spätes Nachverhandeln lohnt sich | ZQ-01 |
| E-K2-3 | Sieht der Lieferant beide Quoten im Spiegel? | ja, beide Quoten seiner Beziehung, kein Vergleich mit anderen Lieferanten; Beleg je Buchung | Gegenseitigkeit fehlt | ZQ-01, AK-01, LP-01 |
| E-K2-4 | Ist ein Mandat Pflicht? | Pflicht für strategische Beziehungen, sonst freiwillig | ohne Mandat keine Prüfung von Deals gegen Grenzen | MD-01 |
| E-K2-5 | Ordnet Reziproq Mails selbst zu? | ja ab Konfidenz 0,9, darunter als Entwurf; Schwelle nach zwei Wochen Betrieb prüfen | alles durch Kurz prüfen | PO-01 |
| E-K2-6 | Bestätigt der Lieferant mit oder ohne Konto? | ohne Konto: Link mit Passkey, an die Person gebunden, 14 Tage gültig | höhere Hürde vor Kapitel 5 | BL-01 |
| E-K2-7 | Bleibt die SupplierBar auf Termin- und Plan-Seiten? | nein; sie ist der Kopf der Akte | – | AK-01 |
| E-K2-10 | Welche Lieferanten zeigt die Liste unter „Lieferanten“? | Gründer am 27.11.2026: die aktiven Beziehungen (angebunden, PLT-03 `active`), wie die Vorlage mit 16. Die Linse Segmente zeigt das ganze Portfolio mit den importierten Lieferanten ohne Anbindung (`draft`), wie die Vorlage mit 46. Entwürfe findet man in der Liste über „Mehr Filter: Portfolio“ | alle in der Liste; oder nach Team | BZ-01 |
| E-K2-9 | Braucht die Akte eine Tabelle `shared_item` mit `author_side` für „Von <Gegenüber>“? | nein (Gründer am 26.11.2026): „Von <Gegenüber>“ ergibt sich aus dem Raum der vorhandenen Objekte (`app_row_space` = `shared`) und der Seite der besitzenden Organisation (E-K0-31). `prepared_by` und `summary_items` der Feedback-Welle kommen mit K2-f an `survey_wave` | eigene Tabelle, doppelte Daten | AK-01 |
| E-K2-8 | Wie heißen die Hauptpunkte Beziehungen und Wert? | Gründer am 26.11.2026: Lieferanten und Ergebnisse, „das macht sonst für mich keinen Sinn“. Gilt für Navigation, Seitentitel und Zurück-Links; die Adressen `/beziehungen` und `/wert` bleiben, beim Lieferanten bleibt Kunden. Beziehung bleibt der Begriff für die Beziehung selbst, Wert für Wertkonto, Wertart und Wertbericht | Beziehungen und Wert wie in NAV-10 2.0 | NAV-10, BZ-01, WK-01, Designsprache, Glossar |

## Kapitel 3: Termin

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K3-1 | Ist Ziel 1 „Prognose gegen Preis und Lieferzeit“? | ja | Mappe aus Kapitel 1 führt nicht ins JBP | TE-01, Seed |
| E-K3-2 | Gehen Agenda und Beitragsanfragen mit einer Freigabe raus? | ja; Anfragen lassen sich im Dialog abwählen | zwei Schritte | BE-01 |
| E-K3-3 | Baut Reziproq das Deck selbst nach der Frist? | ja, als Entwurf (Bauen auf Erledigen, Teilen durch Menschen) | Engpass vor dem JBP bleibt | DK-01 |
| E-K3-4 | Vorlauf des Briefings vor einem JBP | 10 Tage (statt 7) | Briefing kommt nach der Agenda-Frist | TE-01, KI-07 |
| E-K3-5 | Darf Reziproq Beiträge aus vorhandenen Unterlagen als „liegt vor“ zuordnen? | ja, mit Fundstelle und Datum der Fundstelle; die andere Seite kann ersetzen | alles wird angefragt | BE-01 |
| E-K3-6 | Stehen Zitate aus dem Transkript im Protokoll? | nein, nur bei euch zum Prüfen | Vertrauen im Termin leidet | PR-01 |
| E-K3-7 | Wie lange bleibt der Rohtext eines Transkripts? **(einzeln entschieden)** | 90 Tage als Standard; Admin wählt 30, 90 oder 180 Tage; länger nur mit Einwilligung beider Seiten; Transkripte nur, wenn eine Betriebsvereinbarung hinterlegt ist | – | PR-01, KA-01 |

## Kapitel 4: Wert

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K4-1 | Wie bestätigt das Controlling? | Link mit Token wie bei Beiträgen; Konto optional für häufige Nutzer | Konto für jede Person im Controlling | WK-01 |
| E-K4-2 | Woher kommen die Stunden für die Beziehungsrendite? **(einzeln entschieden)** | nur Summen je Beziehung aus gemeinsamen Terminen und erledigten Aufgaben; nie je Person sichtbar, gespeichert als Auswertung oder exportierbar; keine Zeiterfassung; Stunden des Lieferanten als Schätzung; Funktion ist standardmäßig aus und wird vom Admin eingeschaltet, wenn eine Betriebsvereinbarung vorliegt (im Demo-Mandanten an) | – | WK-01, Rechte |
| E-K4-3 | Wer pflegt die Kostensätze für Reibung? | Startwerte je Ereignisart in den Einstellungen, änderbar durch Lead, jede Änderung versioniert | – | WK-01 |
| E-K4-4 | Braucht der Verlauf je Kennzahl ein eigenes Board? | nein, Blatt aus der Scorecard-Zeile | – | GP-01 |
| E-K4-5 | Darf der Wertfinder Lieferanten außerhalb des Fokus prüfen? | ja auf Knopf; automatisch monatlich nur Fokuslieferanten | Kosten und Rauschen | WK-01 |

## Kapitel 5: Deal und Lieferantenseite

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K5-1 | Eigene Wert-Sicht für Lieferanten über alle Kunden? | nicht in Kapitel 5; Wert je Deal steht in der Mappe; Wertkonto für Lieferanten später (Kann) | – | LP-01 |
| E-K5-2 | Wer darf bei Hollmann außerhalb des Mandats annehmen? | der Lead der Beziehung; Vertretung in den Einstellungen; sonst bietet Reziproq die Option nicht an | – | DL-01, MD-01 |
| E-K5-3 | Eigene Freigaberegel beim Lieferanten? | optional (z. B. zweite Person ab einem Wert); Standard: eine Person mit Rolle Sponsor | – | LP-01 |
| E-K5-4 | Was passiert, wenn der Lieferant seine Kostenspanne zurückzieht? | die Spanne verlässt die Mitte; Hollmanns Bewertung wird als „Spanne zurückgezogen“ markiert und rechnet wieder mit Branchenwerten | – | DL-01, LA-01 |
| E-K5-5 | Darf ein Lieferant denselben Deal mehreren Kunden vorschlagen? **(einzeln entschieden, abweichend von der Empfehlung)** | Vorlagen erlaubt, Daten nicht: Der Lieferant darf eigene Vorlagen (Aufbau und Text eines Vorschlags) wiederverwenden. Eine Vorlage enthält nie Konditionen, Mengen, Kosten oder andere Daten aus einer Kundenakte; Reziproq füllt sie je Akte nur mit Daten dieser Akte. Jeder Vorschlag wird je Akte einzeln gesendet. Der Agent sieht immer nur eine Akte. | – | LA-01, LP-01, DL-01 |
| E-K5-6 | Wer spielt Kim Kaiser in Kundendemos? | standardmäßig der Simulator; zweite Person nur mit Zeit für eine Probe | – | SI-01 |

## Kapitel 6: Warengruppe

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K6-1 | Wie oft schreibt Reziproq eine Strategie fort? | als Entwurf bei jedem übernommenen Marktsignal und jeder neuen Bewertungsrunde; eine neue Version nur auf Knopf oder vor dem Quartals-Review | – | ST-01 |
| E-K6-2 | Wer hält eine Freigabe fest? | Lead der Warengruppe; Vertretung in den Einstellungen; Beschluss mit Datum und Notiz | – | ST-01 |
| E-K6-3 | Was passiert mit Mandat-Vorschlägen, die niemand bearbeitet? | Erinnerung nach 5 Arbeitstagen, nach 10 Tagen Hinweis an den Lead; bis dahin gilt das alte Mandat | – | MV-01 |
| E-K6-4 | Ändert ein Marktsignal Lieferantenpläne direkt? | nein: Hinweis in der Akte und Entwurf in der Strategie; Pläne folgen der freigegebenen Strategie | – | MS-01 |
| E-K6-5 | Woher kommen Marktsignale? **(einzeln entschieden)** | im MVP nur frei nutzbare Quellen (öffentliche Indizes mit erlaubter Nutzung, eigene Verträge); lizenzpflichtige Börsendaten erst nach dem Pilot mit Lizenz; die Demo nutzt eine synthetische Kupferkurve und nennt keine Börse | – | MS-01, DM-01 |
| E-K6-6 | Jan-Luka steht in keinem Team | in Seed und Boards als SRO Rheintal und Mitglied Leiterplatten eintragen (Konsistenzrunde) | – | DM-01 |

## Kapitel 7: Kanäle

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K7-1 | Welche Plattformen zuerst? | Microsoft 365 (Add-in für Mail und Kalender, Chat-App); Google Workspace und Slack in Stufe 2 | – | KA-01 |
| E-K7-2 | Interne Freigaben im Chat standardmäßig an? | ja für Wert und Plan intern; Admin kann sie abschalten | – | KA-01 |
| E-K7-3 | Sprache auch am Desktop? | nein, zuerst nur mobil | – | KA-01 |
| E-K7-4 | Mails, die mehrere Lieferanten betreffen | Zuordnung als Entwurf in Kurz prüfen, je Lieferant ein Eintrag; nie automatisch in mehrere Akten | – | PO-01, KA-01 |
| E-K7-5 | Chat-Karten für Lieferanten? | nicht in Kapitel 7; Benachrichtigung per Mail mit Link in die Akte | – | KA-01, LP-01 |

## Kapitel 8: Warengruppe steuert sich

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K8-1 | Wie weit geht die Vergabe? **(einzeln entschieden)** | bis zur Vergabe-Mappe, dazu Verhandlung der Agenten: nur unverbindlich, nur im vom Menschen freigegebenen Rahmen, höchstens 3 Runden, jederzeit stoppbar; bindend nur das vom Lieferanten bestätigte Angebot und die Vergabe durch den Lead | ohne Agenten-Verhandlung entfallen K8-e, `negotiation_*` und L8-Angebot (Runden) | VG-01, LA-01, LP-01 |
| E-K8-2 | Wie heißen Hebel? **(einzeln entschieden)** | Hypothese mit Annahmen; nie „Wette“ | – | WT-01, ST-01 |
| E-K8-3 | Wer entscheidet Anteile und Vergaben? | Lead der Warengruppe, Vertretung in den Einstellungen; der Commodity Manager bereitet vor und gibt den Verhandlungsrahmen frei | – | SZ-01, VG-01 |
| E-K8-4 | Wie wird Abhängigkeit gemessen? | Anteil des Bedarfs mit nur einer qualifizierten Quelle (Einzelquelle); die Grenze steht in der Strategie (Demo 15 %) | – | SZ-01, WT-01 |
| E-K8-5 | Woher kommen Soll-Kosten? | eigene Daten und frei nutzbare Quellen, Sicherheit sichtbar; nie Daten anderer Kunden, nie Zahlen an Lieferanten | – | WZ-01, VG-01 |
| E-K8-6 | Muss der Lieferant Agenten-Verhandlungen zulassen? | ja, je Anfrage; Standard aus; ohne Zulassung gehen Runden als Entwurf an einen Menschen beim Lieferanten | – | VG-01, LP-01, LA-01 |
| E-K8-7 | Wann entsteht die Review-Vorlage? | 10 Arbeitstage vor dem Review; nur Abweichungen und Entscheidungen | – | RV-01 |

## Paket K0: Klärungen zum Bestand (24.11.2026)

Aus der Prüfung der Specs gegen den Code (`docs/k0-abweichungen.md`, Fragen F-01 bis F-24 und Widersprüche C-01 bis C-17). Jan-Luka hat am 24.11. alle Empfehlungen übernommen. Die Nummer der Entscheidung entspricht der Frage (E-K0-01 = F-01); E-K0-25 bis E-K0-32 lösen Widersprüche zwischen Specs. C-02, C-07 und C-18 sind am selben Tag nachentschieden (E-K0-33 bis E-K0-35).

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K0-01 | Blatt, Überlagerung und Dialoge, obwohl PLT-10 Pop-ups verbietet? | ja, eng: erlaubt sind nur das Blatt (620 px von rechts, Esc schließt, Fokus bleibt im Blatt, mobil volle Seite), die Überlagerung „Frag Reziproq“ (⌘K, mobil Vollbild) und die Dialoge „So teilen“ (DK-01) und „Agenda freigeben“ (BE-01). Toasts, Popover und andere Überlagerungen bleiben verboten; der Test gegen Pop-ups führt ab K1-d eine feste Liste dieser Bausteine | ohne Blatt werden Details wieder eigene Seiten, gegen G-8 | PLT-10, NAV-10, Designsprache, AK-01, DK-01, BE-01 |
| E-K0-02 | Seitenleiste fixiert oder so hoch wie die Seite? | so hoch wie der Bildschirm; sie scrollt nicht mit, nur der Inhalt scrollt (Entscheidung vom 23.11. bleibt) | – | NAV-10, Designsprache |
| E-K0-03 | Raum je Zeile (ZA-01): neue Spalte an allen Tabellen oder abgeleitet? | abgeleitet: Bestehende Tabellen bekommen `space` aus ihrer Ebene im Register, der besitzenden Seite und `visibility`; die Policies aus PLT-04 bleiben. Die technische Form (Spalte mit Trigger oder Sicht) legt K1-a fest. Neue Tabellen bekommen `space` als Spalte. `origin` und `confirm_state` werden echte Spalten an den Objekten, die die Specs nennen | Umbau aller 162 Tabellen und ihrer Policies | ZA-01 |
| E-K0-04 | Demo-Mandant | Hollmann Antriebe ist ein eigener Demo-Mandant (`org.is_demo`) mit eigenem Seed und synthetischen Personen nach DM-01. Test-OEM, Zweit-OEM und Test-Lieferant bleiben Grundlage der automatischen Tests. `pnpm demo:setup` richtet weiter die echten Konten ein | – | DM-01, CLAUDE.md |
| E-K0-05 | Rollenwechsel der Demo-Regie bei Anmeldung über Zitadel | Demo-Sitzung je Person ohne Zitadel, nur wenn `org.is_demo` gilt und nie in Produktion; Bestätigungslinks nutzen echte Passkeys | Konten je Person im Zitadel-Testmandanten | DM-01, SI-01 |
| E-K0-06 | Passkey ohne Konto (BL-01) | beim ersten Öffnen ein Einmalcode an die Mailadresse der Person, dann Passkey anlegen; die Identität gehört zu Person und Link. Ein weitergeleiteter Link scheitert am Code | – | BL-01, BE-01, WK-01 |
| E-K0-07 | Wer ist „Lead der Beziehung“? | der Lead der Haupt-Warengruppe der Beziehung; Vertretung je Lead unter Einstellungen › Organisation. Die Vertretung gilt auch für E-K6-2 und E-K8-3 | – | MD-01, DL-01, ST-01, SZ-01, VG-01 |
| E-K0-08 | Rollen beim Lieferanten | die Teamrolle `sro` beim Lieferanten heißt Key Account (Migration, Rechte unverändert); Sponsor und Mitglied bleiben | – | LP-01, LIF-01 |
| E-K0-09 | Wer ist „strategisch“? | Fokuslieferanten (SEG-02); gilt für die Pflicht zum Mandat (E-K2-4) und den Filter „Strategisch“ | Segment „Strategisch“ aus der Konsolidierung | MD-01, BZ-01 |
| E-K0-10 | Geldbeträge in neuen Tabellen | Ganzzahl in Cent (`bigint`) mit Währung, Spannen als `low_cents` und `high_cents`, Anteile wie im Bestand in Basispunkten. Die SQL in den Specs ist eine Skizze | – | WK-01, DL-01, LA-01, MS-01, WZ-01, SZ-01, VG-01 |
| E-K0-11 | Wertart „strategisch“ (im Code, nicht in WK-01) | bleibt als Wirkungsart ohne Euro; erscheint nicht in Kacheln, Pipeline oder Summen | – | WK-01, WT-01, PNL-07 |
| E-K0-12 | Bestätigung durch das Controlling | per Link mit Token (E-K4-1) oder mit Konto und Recht Controlling | – | WK-01, PNL-06 |
| E-K0-13 | Eigene Agenten (KI-09) sind gebaut | in K1-f Oberfläche und Routen entfernen, Funktion aus; die Tabellen bleiben, bis über KN-54 entschieden ist | – | KI-09, MA-01 |
| E-K0-14 | Gilt der Pilotpfad vom 23.11. weiter? | ja, parallel: Durchstich D, sobald die Zugänge da sind; C1 bis C6 nach K2-g | Pilot erst nach Paket Z | Umsetzungsplan |
| E-K0-15 | Offene Schritte des alten Plans | ruhen. 32 und 33 gehen in ST-01 auf, 35 (KI-19) entfällt, 36 und 37 gehen in DL-01 und SZ-01 auf, 38 in WB-01, 39 in LA-01; 34 (KI-18) wird Teil von K3-d; 31b wird nicht gebaut | – | Umsetzungsplan |
| E-K0-16 | Freigegebener Plan nimmt keine neuen Zusagen an (JBP-06, F15) | Zusagen hängen an der Beziehung, nicht an der Planversion; ein freigegebener Plan blockiert keine Zusage | – | ZQ-01, GP-01, JBP-05, JBP-06 |
| E-K0-17 | Gewicht des Segments in der Triage | Gewicht je Segmenttyp im Segmentmodell, Start 1,0, für den strategischen Typ 2,0; einstellbar unter Einstellungen › Segmentierung | – | HE-01, SEG-01 |
| E-K0-18 | EBIT-Ziel je Warengruppe | die Initiative bekommt die Warengruppe; Ziel je Warengruppe in Cent | – | ST-01, WK-01 |
| E-K0-19 | Termin der Freigabe einer Strategie | Feld „Freigabe geplant am“ an der Strategie-Version; erscheint als Chip und in den Terminen | – | ST-01 |
| E-K0-20 | Widersprüche zwischen Specs | entschieden in E-K0-25 bis E-K0-35 | – | – |
| E-K0-21 | Beziehungsnetz und ältere Specs | das Netz zeigt Funktionen und Gesprächspaare mit „Draht“ (wie K2-Akte-Privat), keine Haltung je Person (CLAUDE.md: keine Bewertung einzelner Personen). Ältere Specs tragen einen Statuskopf „abgelöst“ oder „gilt weiter mit Änderungen“ | – | AK-01, Inventar T2-I25 und T2-I26 |
| E-K0-22 | Umsetzungsnotizen der ersetzten KI-Specs | zurück als Abschnitt „Umsetzung bis 23.11.2026“ | – | KI-03, KI-07, KI-08, KI-09, KI-11, KI-15, KI-16, KI-17 |
| E-K0-23 | CLAUDE.md | nachgezogen: kein Push (G-1), Demo (E-K0-04), fünfzehn Regeln, Rangfolge, Verweis auf diese Datei | – | CLAUDE.md |
| E-K0-24 | UX-Plan in `docs/plan/` | abgelöst durch den Umsetzungsplan; F-UX-03 (JBP-Termin) entfällt durch TE-01, F-UX-02 (Beziehungsnetz) geht in E-K0-21 auf | – | – |
| E-K0-25 | Akte-Kopf auf Termin und Plan (C-01) | nein (E-K2-7): Der Termin hat seinen eigenen Kopf (TE-01), der Gemeinsame Plan den Zurück-Link „‹ <Beziehung>“ und einen eigenen Titel. Wertkonto, Mandat und Deal behalten den Akte-Kopf | – | AK-01, GP-01 |
| E-K0-26 | Gruppen der Ansicht Alles (C-03) | Für dich, Bei anderen, Zuordnen, Hinweise, Zusagen und Aufgaben; „Maßnahmen“ und „Weitere Hinweise“ im Inventar meinen diese Gruppen | – | HE-01, Inventar |
| E-K0-27 | Zusage des Käufers aus einer Mail (C-04) | Fokus-Thema, nie Kurz prüfen (HE-01, PO-01); Drehbuch K2 öffnet den Entwurf aus Heute; das Board K2-Mail-Zusage gilt nur für den Aufbau | – | DM-01, PO-01, HE-01 |
| E-K0-28 | Wer bestätigt einen Strategie-Teil (C-05) | der Lead der Warengruppe oder ein Commodity Manager im Team (ST-01); die Zeile der Rechte-Ergänzung ist angepasst | – | ST-01, Rechte |
| E-K0-29 | Anfrage an einen neuen Lieferanten nach einer Entscheidung (C-06) | der Commodity Manager, im Demo Jonas Feld | – | SZ-01 |
| E-K0-30 | Briefing in der Demo am Mo 23.11. (C-08) | der automatische Vorlauf bleibt 10 Tage; im Seed hat Jan-Luka das Briefing am Fr 20.11. von Hand gestartet (KI-07 erlaubt Läufe von Hand) | – | DM-01, TE-01 |
| E-K0-31 | Bedeutung von „Von <Gegenüber>“ (C-09) | immer: was das Gegenüber aktiv geteilt hat (AK-01). Was der Lieferant im Wertkonto sieht, steht als Zeile „Was <Lieferant> sieht“ | – | WK-01 |
| E-K0-32 | Designsprache in sich (C-10) | „Fünfzehn Regeln“; Bausteine, deren Board nicht beiliegt, folgen dem ähnlichsten Board (L-Ueberblick, W-Initiative, K6-Strategie) | – | Designsprache |

**Am 24.11. nachentschieden (Jan-Luka: „Empfehlungen übernehmen“):**

| Kennung | Frage | Entscheidung | Folge, wenn anders | Specs |
|---|---|---|---|---|
| E-K0-33 | Segment-Matrix (C-02): BZ-01 und Board K2-Segmente zeigen 2 × 2 („Versorgungsrisiko und Wertbeitrag“: Strategisch, Hebeln, Absichern, Entwickeln), Glossar, Designsprache, SEG-01 und Code 3 × 3 | Die Größe der Matrix ist je Segmentmodell einstellbar (2 × 2 oder 3 × 3), Achsen und Namen je Kunde. Standard bleibt 3 × 3 (Business Impact × Beziehungsqualität); Hollmann nutzt 2 × 2 wie im Board | ein festes Raster für alle Kunden | BZ-01, SEG-01, Designsprache, Glossar |
| E-K0-34 | Monat des Wertberichts (C-07) | Regel aus WB-01: am ersten Montag für den Vormonat, nach dem Monatsabschluss. Im Demo ist am Mo 23.11. der Bericht Oktober noch Entwurf (Frist Mo 30.11.), nach „Monat vorspulen“ der Bericht November | Bericht für den laufenden Monat | WB-01, DM-01 |
| E-K0-35 | Designsprache oder Spec (C-18) | Im Aussehen gilt die Designsprache vor der Spec (CLAUDE.md, Oberfläche, Regel 7); für Inhalt und Verhalten gilt die Rangfolge aus LIESMICH | – | CLAUDE.md |
| E-K0-36 | Push trotz G-1 | Jan-Luka erlaubt am 24.11. wieder den Push des Arbeitsbranchs zu `origin` nach jedem grünen Commit (Sicherung); nie `main`, nie `--force`, weiter kein `gh` und keine GitHub Actions. G-1 ist angepasst | nur lokal | CLAUDE.md |

## Festgelegte Grundregeln (ohne offene Frage, gelten überall)

| Kennung | Regel |
|---|---|
| G-1 | Lokal entwickeln: kein `gh`, keine GitHub Actions; `git push` nur des Arbeitsbranchs zu `origin` nach grünem `pnpm check`, nie `main`, nie `--force` (geändert am 24.11., E-K0-36). Keine Zugangsdaten im Repo; der Modell-Schlüssel steht nur in der lokalen Konfiguration. |
| G-2 | Lieferanten sehen nie private Daten der Käuferseite, und die Käuferseite sieht nie die private Seite des Lieferanten. Durchgesetzt in der Datenbank (Row Level Security), nicht nur in der Oberfläche. |
| G-3 | Wertarten (EBIT, Kostenvermeidung, Cash) werden nie addiert, in keiner Sicht, keinem Export, keinem Satz. |
| G-4 | Claims, Risiko und Vertrag bleiben ausgeschaltet und werden nicht umgesetzt (KN-39 Vertragsleck ebenfalls nicht). |
| G-5 | Bindende Werkzeuge laufen nur mit Bestätigungs-Token eines Menschen. Die Stufe eines Mandats kann Reziproq nur bremsen, nie weiter lassen als Mein Agent. |
| G-6 | Der Code rechnet, das Modell erklärt. Jede gebuchte oder angezeigte Zahl kommt aus der Wert-Engine oder aus Daten; ein Satz mit einer Zahl, die nicht belegt ist, wird nicht angezeigt. |
| G-7 | Jede Nachricht in die Mitte trägt eine Kennzeichnung: Mensch, mit Reziproq oder Reziproq. |
| G-8 | Eine Seite gibt es nur für ein Objekt, eine Entscheidung (Mappe) oder eine Einstellung. Schritte werden Entwürfe in Kurz prüfen, eine Mappe oder ein Abschnitt einer Akte. |
| G-9 | Warengruppen kommen nach dem Lieferantenmanagement. |
| G-10 | Keine Inhalte aus Unterlagen echter Kunden in Seed, Tests oder Texten; nur der Demo-Mandant Hollmann mit synthetischen Daten. |
