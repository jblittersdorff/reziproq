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
| E-K5-2 | Wer darf bei Nordwind außerhalb des Mandats annehmen? | der Lead der Beziehung; Vertretung in den Einstellungen; sonst bietet Reziproq die Option nicht an | – | DL-01, MD-01 |
| E-K5-3 | Eigene Freigaberegel beim Lieferanten? | optional (z. B. zweite Person ab einem Wert); Standard: eine Person mit Rolle Sponsor | – | LP-01 |
| E-K5-4 | Was passiert, wenn der Lieferant seine Kostenspanne zurückzieht? | die Spanne verlässt die Mitte; Nordwinds Bewertung wird als „Spanne zurückgezogen“ markiert und rechnet wieder mit Branchenwerten | – | DL-01, LA-01 |
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

## Festgelegte Grundregeln (ohne offene Frage, gelten überall)

| Kennung | Regel |
|---|---|
| G-1 | Lokal entwickeln: kein `git push`, kein `gh`, keine GitHub Actions. Keine Zugangsdaten im Repo; der Modell-Schlüssel steht nur in der lokalen Konfiguration. |
| G-2 | Lieferanten sehen nie private Daten der Käuferseite, und die Käuferseite sieht nie die private Seite des Lieferanten. Durchgesetzt in der Datenbank (Row Level Security), nicht nur in der Oberfläche. |
| G-3 | Wertarten (EBIT, Kostenvermeidung, Cash) werden nie addiert, in keiner Sicht, keinem Export, keinem Satz. |
| G-4 | Claims, Risiko und Vertrag bleiben ausgeschaltet und werden nicht umgesetzt (KN-39 Vertragsleck ebenfalls nicht). |
| G-5 | Bindende Werkzeuge laufen nur mit Bestätigungs-Token eines Menschen. Die Stufe eines Mandats kann Reziproq nur bremsen, nie weiter lassen als Mein Agent. |
| G-6 | Der Code rechnet, das Modell erklärt. Jede gebuchte oder angezeigte Zahl kommt aus der Wert-Engine oder aus Daten; ein Satz mit einer Zahl, die nicht belegt ist, wird nicht angezeigt. |
| G-7 | Jede Nachricht in die Mitte trägt eine Kennzeichnung: Mensch, mit Reziproq oder Reziproq. |
| G-8 | Eine Seite gibt es nur für ein Objekt, eine Entscheidung (Mappe) oder eine Einstellung. Schritte werden Entwürfe in Kurz prüfen, eine Mappe oder ein Abschnitt einer Akte. |
| G-9 | Warengruppen kommen nach dem Lieferantenmanagement. |
| G-10 | Keine Inhalte aus Unterlagen echter Kunden in Seed, Tests oder Texten; nur der Demo-Mandant Nordwind mit synthetischen Daten. |
