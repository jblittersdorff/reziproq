# Inventar: was aus entfallenen Seiten wird

Stand 24.11.2026 · Kapitel 1 bis 7 (Kapitel 8 ersetzt keine Seiten; die alten Vergabe-Seiten stehen in Kapitel 6, T6-08).

Regel G-8: Eine Seite gibt es nur für ein Objekt, eine Mappe oder eine Einstellung. Für jede entfallende Seite steht hier jede Information mit ihrem neuen Ort. Je Zeile gibt es einen Test, der die Information am neuen Ort findet (Test-ID in der ersten Spalte, „Fertig, wenn“ der genannten Spec). Die alten Boards liegen im Canvas im Archiv („Ersetzt in Kapitel …“) und sind nicht Teil von `docs/design/referenz/`.

## Kapitel 1 · Heute (HE-01, Tests T1-I01 bis T1-I16)

Entfallene Seiten: Mein Tag, Alle Aufgaben, Hinweise, Neu eingegangen, Agenten, Lauf eines Agenten.

| Test | Alte Seite | Information | Neuer Ort |
|---|---|---|---|
| T1-I01 | Alle Aufgaben | Reiter Für mich, Wartet auf andere, Maßnahmen | Heute, Ansicht Alles: Gruppen Für dich, Bei anderen, Maßnahmen |
| T1-I02 | Alle Aufgaben | Gruppen Überfällig, Heute, Diese Woche, Später | Frist als Chip in jeder Zeile, Reihenfolge der Triage, Filter „Frist“ |
| T1-I03 | Alle Aufgaben | Je Aufgabe Lieferant, Art (Wert, Freigabe, Unterschrift, Bewertung, Feedback), Frist | Zeile in Für dich: Unterzeile und Chip; Filter „Art“ |
| T1-I04 | Alle Aufgaben | Aufgabe „Liefertreue Oktober erfassen“ | Kurz prüfen, Entwurf 1 |
| T1-I05 | Hinweise | 7 Hinweise mit Schwere, Regel, Warengruppe, offen seit | Ansicht Alles (Für dich, Bei anderen, Weitere Hinweise); Filter „Schwere“, „Warengruppe“; Regel und Datum im Warum |
| T1-I06 | Hinweise | Beleg (Liefertreue Aug 91 %, Sep 88 %, Okt 86 %, Ziel 95 %), „Warum es zählt“, Quellen | Warum zum Hinweis |
| T1-I07 | Hinweise | Knöpfe „In Arbeit“, „Nicht relevant“, „War dieser Hinweis hilfreich?“ | Warum zum Hinweis, unten |
| T1-I08 | Hinweise | Ablauf Maßnahme: Anlass, Anlegen, Verfolgen | Anlass = Zeile in Ansicht Alles; Anlegen = Entwurf in Kurz prüfen; Verfolgen = Maßnahmen der Beziehung |
| T1-I09 | Hinweise | Regel „Verworfene Hinweise bleiben 90 Tage still“ | Fußzeile der Ansicht Alles |
| T1-I10 | Neu eingegangen | 3 unklare Termine mit Vorschlag und Begründung | Kurz prüfen, Entwurf „6 Zuordnungen bestätigen“; Liste in Ansicht Alles |
| T1-I11 | Neu eingegangen | Heute selbst zugeordnet · 4 | Erledigt, mit Zurücknehmen |
| T1-I12 | Neu eingegangen | „Wie Termine ankommen“ (Add-in, Eingangsadresse, Kalender), „Privat bleibt privat“ | Einstellungen, Anbindungen; Link aus Ansicht Alles |
| T1-I13 | Agenten | Liste der Aufgaben von Reziproq mit Daten, Auslöser, aktiv oder aus | Einstellungen KI, Abschnitt „Aufgaben von Reziproq“ mit Ein und Aus; Mein Agent mit Stufe |
| T1-I14 | Agenten | Dein nächster Schritt: Entwürfe der QBR-Vorbereitung prüfen | Kurz prüfen |
| T1-I15 | Lauf eines Agenten | Schritte, Quellen, Entscheidungen, Kosten | Warum, Abschnitt Lauf; Erledigt |
| T1-I16 | Mein Tag | alle Teile | Heute nach HE-01, Abschnitt „Aufbau“ (Teile von Mein Tag, siehe unten) |

**Teile von Mein Tag (zu T1-I16)**

| Teil in Mein Tag (vorher) | Wo es jetzt steht |
|---|---|
| Als Nächstes: „Liefertreue Oktober für Rheintal erfassen“, Knopf „Wert erfassen“ | Kurz prüfen, Entwurf 1: „Liefertreue Oktober: 94 % übernehmen“. Rheintal hat den Wert gemeldet; das ist Fleißarbeit, keine Entscheidung. |
| Fortschritt „0 von 3 für heute erledigt“ | entfällt; Fortschritt zeigt sich als erledigte Fokus-Themen und als Wert (Kapitel 4) |
| Heute · 2 weitere: Wirkung „Preis Leiterplatten“ freigeben | Fokus, Chip „Freigabe“ |
| Heute · 2 weitere: Briefing JBP Rheintal prüfen | Kurz prüfen, Entwurf 2 |
| Von Reziproq vorbereitet · 4 Entwürfe | Kurz prüfen · 5 Entwürfe (Briefing, zwei Themen, Zusage Alpen, 6 Zuordnungen aus Postfach und Import, dazu Liefertreue) |
| Von Reziproq vorbereitet: Neues Wertpotenzial bei Kessler Präzision | entfällt im Demo-Mandanten; ein neues Wertpotenzial ist ein Fokus-Thema, hier das von Rheintal |
| Von Reziproq vorbereitet: Marktanalyse Leiterplatten bestätigen | Warengruppe Leiterplatten; ab Kapitel 6 als Marktsignale (MS-01) und Strategie Teil 1 (ST-01) |
| Diese Woche · 4 | rechts „Diese Woche“, 3 Einträge; der vierte (Zwei Themen ergänzen) ist ein Entwurf in Kurz prüfen |
| Nächste 14 Tage: Termine und Fristen | entfällt auf Heute; Termine stehen in der Akte unter „Nächste Wochen“ und im Termin (TE-01) |
| Wartet auf andere · 4: 8D-Bericht Charge 4711 (Nils Ott, überfällig) | Fokus: „Ruf Nils Ott an“, Chip „Gespräch“; zwei Mails blieben ohne Antwort, also ist ein Anruf der nächste Schritt |
| Wartet auf andere: Beitrag Machbarkeit Lieferzeit (Tom Weber) | rechts „Wartet auf andere“; Ansicht Alles, Gruppe „Bei anderen“ |
| Alle 11 Aufgaben | Ansicht „Alles“ über den Umschalter |

## Kapitel 2 · Beziehungen und Akte (BZ-01, AK-01, Tests T2-I01 bis T2-I30)

| Test | Altes Board | Information | Neuer Ort |
|---|---|---|---|
| T2-I01 | Lieferanten | Zahl, Spend, Import-Knopf, Suche | Kopf Beziehungen; Zeile „Lieferanten importieren“; Frag Reziproq |
| T2-I02 | Lieferanten | Filter Fokus, Meine, Segment, Soll-Typ, Warengruppe, Business Unit, Mehr; Sortierung nach Spend | Filter-Chips und „Mehr Filter“; Sortierung umschaltbar |
| T2-I03 | Lieferanten | Segment-Text je Zeile (zum Beispiel „Hoher Impact · ausbaufähig“), Spend je Zeile | Segment-Chip und Spend in der Zeile; Ist und Soll je Warengruppe in Nur für dich |
| T2-I04 | L-Ueberblick | Schrittfolge Segment, Plan, JBP, Ergebnisse | graue Zeile im Kopf „im Jahreszyklus“ |
| T2-I05 | L-Ueberblick | Als Nächstes JBP-Briefing, Agenda bis 27.11. | Nächste Wochen in Gemeinsam; Fokus in Heute |
| T2-I06 | L-Ueberblick | Ergebnisse 74 von 100 T€, Potenzial 140 bis 200 T€ | Nur für dich, Wert und Mandat; Wert (Kapitel 4) |
| T2-I07 | L-Ueberblick | Aktivitäten, Gemeinsamer Plan, Beziehungsnetz mit Stand-Chip | Verlauf; Plan und Spielregeln; Beziehungsnetz |
| T2-I08 | L-Ueberblick | Claims und Risiken, Frist Claim 02.12. | Modul aus: nicht sichtbar; erscheint wieder, wenn das Modul an ist |
| T2-I09 | L-Ueberblick | Leistung: Liefertreue, Reklamationen, Prognosetreue | Scorecard in Gemeinsam |
| T2-I10 | L-Ueberblick | Kennzahlen Spend +8 %, Anteil 38 %, Lücke 0,9; Kontakte mit Stärke | Profil-Blatt; Feedback-Zeile; Beziehungsnetz |
| T2-I11 | L-Profil | Stammdaten, Kontakte, Spend je Jahr, externe Nummer, seit | Profil-Blatt |
| T2-I12 | L-Warengruppen | Spend je Warengruppe, Lead, Anteil, Segment Ist und Soll, Strategie, Widerspruch, „Leads zusammenbringen“ | Nur für dich, Warengruppen; Entwurf „Leads abstimmen“ |
| T2-I13 | L-Segmentierung | Segment, Abstand zur Grenze, Kriterien mit Mittel und Spanne, Bewertende, Datum, Spielregeln-Folge | Nur für dich, Segment und Bewertung; Linse Segmente |
| T2-I14 | PF-Portfolio | Matrix, Zahlen je Feld, Spend nach Segment, ohne Bewertung, Fokus | Linse Segmente |
| T2-I15 | PF-Runde-Start | Auswahl der Lieferanten mit Grund, Bewertende, Frist, Kriterien und Gewicht, Regel „mindestens 2“ | Entwurf „Runde vorschlagen“; Linse Segmente, „Wie die Runde entstand“ |
| T2-I16 | PF-Runde | Stand 12 von 18, Stand je Lieferant, Erinnerung, Nachnominieren | Linse Segmente, Bewertungsrunde; Nachnominieren über Frag Reziproq |
| T2-I17 | PF-Bewerten | Kriterien mit Frage und Skala, Begründung Pflicht bei 1 oder 5 | K2-Bewertung in Kurz prüfen |
| T2-I18 | PF-Konsolidieren | Bewertungen mit Begründung, Daten, Folge, Entscheidung mit Begründung | Mappe K2-Segment-Mappe |
| T2-I19 | L-Notizen | Verlauf, Filter, Notiz mit Sichtbarkeit, Datei, Angeheftet, Frag zu Rheintal | Nur für dich, Verlauf |
| T2-I20 | P-Zusagen | Zusagen beider Seiten mit Person, Thema, Frist, Status; Erinnern; Zusage geben | Gemeinsam, Zusagen; „Neue Zusage“; Erinnern durch Reziproq |
| T2-I21 | P-Scorecard | Kennzahlen mit Basis, Ziel, Verantwortung, Messregel; Unterschriften | Gemeinsam, Scorecard (Zeile öffnet Verlauf und Messregel); Freigabe in Heute |
| T2-I22 | U-Massnahmen, U-Massnahme | Maßnahmen geteilt und intern mit Verantwortung, Frist, Anlass, Ziel, Sichtbarkeit | Zusagen in Gemeinsam; Aufgaben in Nur für dich; Heute, Ansicht Alles |
| T2-I23 | L-Lieferantenplan, L-Plan-Neu | Versionen, Freigabe, Ziele, Strategie in drei Sätzen, Beiträge der Funktionen, Änderungen zur Vorversion | Nur für dich, Lieferantenplan; Entwurf Version 3 |
| T2-I24 | B-Team, B-Einladen | Personen beider Seiten mit Rolle und Status, Rechte je Rolle, Einladungstext, Ablauf der Einladung | Profil-Blatt, Team in Reziproq; Entwurf „Einladung“; Von Rheintal, „Rheintal in Reziproq“ |
| T2-I25 | B-Person | Funktion, Berichtet an, Themen, Entscheider, Rolle (Haltung je Person entfällt, E-K0-21) | Profil-Blatt, Kontakte (bearbeiten); Netz in Nur für dich |
| T2-I26 | B-Netz | Gesprächspaare, Entscheider, Draht, Linienstärke | Nur für dich, Beziehungsnetz |
| T2-I27 | B-Spielregeln, B-Spielregeln-Teilen | Rechte, Pflichten, Formate, ungeteilte Änderungen, Vorschläge von Rheintal | Spielregeln-Blatt; Entwurf „Änderungen teilen“ |
| T2-I28 | B-Feedback-Art, -Neu, -Start | Art, Fragen, Personen beider Seiten, Frist, Mail-Vorschau, Anonymität | Entwurf „Welle vorbereitet“ in Kurz prüfen |
| T2-I29 | B-Feedback, -Lauf, -Luecke | Ergebnis je Thema und Frage, Rücklauf, Schwelle, Aufdecken, frühere Wellen, Freitext, eingeladene Personen, Maßnahme | Objekt Feedback |
| T2-I30 | A-Lieferanten, A-Lieferant | mobile Liste und mobiler Überblick | neu gebaut am selben Ort; die alten Boards liegen nur im Archiv |

Navigation: Alte Adressen leiten mit 301 weiter (NAV-10, AK-01, BZ-01).

## Kapitel 3 · Termin (TE-01, BE-01, DK-01, PR-01, Tests T3-I01 bis T3-I16)

| Test | Altes Board | Information | Neuer Ort |
|---|---|---|---|
| T3-I01 | U-Termine | nächster Termin mit Stand, kommende, vorgeschlagene, vergangene Termine mit Ergebnis, offene Zusage aus QBR, Termin anlegen | Termine in Heute und in der Akte (TE-01, Abschnitt „Termine in Heute und Akte“) |
| T3-I02 | Termin-Briefing | Lage mit Quellen, Ziele mit „Erreicht, wenn“ und Wert | Vorbereiten: Das Wichtigste, Ziele |
| T3-I03 | Termin-Briefing | Agenda mit Zeit, Punkt, wer führt, Ziel; „Nicht aufgenommen“ | Vorbereiten: Agenda und Fußnote |
| T3-I04 | Termin-Briefing | Was geklärt werden muss (intern, an Rheintal), Was Rheintal fragen wird mit Antwortvorschlag | Vorbereiten, rechte Spalte; Fragen an Rheintal stehen nach Freigabe am Agendapunkt |
| T3-I05 | Termin-Briefing | Risiken, offene Punkte bis zum Termin | Vorbereiten: Offen bis zum Termin; Risiken als Zeilen in „Das Wichtigste“ |
| T3-I06 | Termin-Briefing | Teilnehmende, Quellen, Aktualität, Transkript-Einstellung, Laufprotokoll | Vorbereiten: Teilnehmende, Danach im Termin, Woraus das Briefing entsteht; Laufprotokoll in Erledigt |
| T3-I07 | J-Anfordern | vorgeschlagene Beiträge je Punkt mit Person, Art, Frist; Fristen und Erinnerung; was Rheintal bekommt | Vorbereiten: Agenda mit Beitragsstand; Freigabe; Abschnitt Beiträge |
| T3-I08 | J-Beitraege | Stand je Beitrag, Dateien, Teilnehmende, Vorschlag aus dem Netz | Vorbereiten: Agenda, Teilnehmende; Deck: Uploads |
| T3-I09 | P-Vorbereitung | Bereitschaft (3 von 5), Geschäftsupdates, Grundlagen (Typ, Ziele, Lücke, Wirkung) | Vorbereiten: Das Wichtigste; Danach im Termin; Akte, Nur für dich |
| T3-I10 | J-Upload | Verarbeitung, Folienauswahl, Agendapunkt, Sichtbarkeit, wohin der Text fließt, ersetzte Schrift | Deck: Uploads; Erledigt (Zuordnung, rücknehmbar) |
| T3-I11 | J-Deck | Folienliste, Folie, Titel von Reziproq mit Quellen, Sprechernotiz, Diagramm, Daten, Export | Deck |
| T3-I12 | J-Teilen | Prüfungen vor dem Teilen, Hinweis T€, Versionen, wer es sieht, Benachrichtigung, Download erlauben | Deck: Als Nächstes, Geprüft vor dem Teilen; Wer es sieht und Download im Dialog „So teilen“ |
| T3-I13 | J-Moderation | Präsentationsmodus mit Festhalten | bleibt (Im Termin) |
| T3-I14 | Termin-Ergebnisse | festgehaltene Punkte, Ergänzungen mit Zitat, Änderung an bestehender Zusage, Transkript-Dauer und Löschung, eigene Notizen | Danach |
| T3-I15 | Termin-Protokoll | Zählung, Entschieden, Offen, Privat, Punkte nach Art, Zusagen, Entscheidungen und Fragen, Teilen | Danach |
| T3-I16 | A-JBP | mobiler Stand der Beiträge | Termin mobil |

## Kapitel 4 · Wert (WK-01, WB-01, GP-01, Tests T4-01 bis T4-11)

| Test | Alte Seite | Inhalt | Neuer Ort |
|---|---|---|---|
| T4-01 | W-Uebersicht | Ergebnisse 2026, Freigaben durch Controlling, Initiativen nach Reifegrad | Wert: Wertarten nebeneinander, Stufen R1 bis R5, „R5 vergibt das Controlling“; offene Freigabe als Mappe |
| T4-02 | KI-Wert-Uebersicht | Potenzial je Lieferant (Kessler am größten) | Wert: Zeile Wertfinder mit 11 Potenzialen, 4 bei Kessler ohne freigegebenen Plan |
| T4-03 | KI-Wert | Potenziale Rheintal 140 bis 200 T€ | Wertkonto Rheintal, Abschnitt Potenziale |
| T4-04 | KI-Wert-Detail | Hebel mit Rechenweg, geprüfte Hebel, Marktsignale, Datenlücken, Sicht Rheintal | Wertkonto: Potenzial öffnet als Blatt; „Was der Wertfinder geprüft hat“ (9 Hebel, 4 Marktsignale, 2 Datenlücken); Zeile „Was Rheintal sieht“ (E-K0-31) |
| T4-05 | P-Themen | Themen beider Seiten sammeln, reihen, parken | Gemeinsamer Plan: Themen ohne Initiative, geparkt mit Version; neue Themen kommen aus Protokoll und Beiträgen (Kapitel 3) |
| T4-06 | P-Initiativen | Initiativen festlegen | Gemeinsamer Plan: Initiativen 2027 in Version 3; Anlegen aus dem Potenzial (Wertkonto) |
| T4-07 | P-Kennzahl | Prognosetreue: Verlauf und Werte | Scorecard in der Akte (Zusagen und Scorecard); Verlauf je Kennzahl als Blatt aus der Zeile |
| T4-08 | Uebersicht (alt) | Terminschiene „Die nächsten vier Wochen“ | Heute, Ansicht Alles (Kapitel 1) |
| T4-09 | Uebersicht (alt) | Ziel je Warengruppe (Gussteile 82 %, Leiterplatten 41 %) | Wert: Zeile je Warengruppe; Warengruppe (Kapitel 6) |
| T4-10 | Uebersicht (alt) | „Strategie Leiterplatten freigeben“ | Wertbericht als Hebel (210 bis 310 T€); Freigabe als Mappe in Kapitel 6 |
| T4-11 | Uebersicht (alt) | Anteil strategischer Lieferanten am Spend | Warengruppe, interne Sicht (Kapitel 6) |
| – | Uebersicht (alt) | Hohe Risiken, Forderungen | Module Risiko und Claims sind aus; keine Anzeige, keine Umsetzung |

Navigation: In der Akte fallen „Themen“, „Initiativen“, „Freigabe“ zu „Plan und Freigabe“ zusammen, „Gesichert“ und „Wertpotenziale“ zu „Wertkonto“. 16 Links in 8 Boards zeigen auf die neuen Ziele.

## Kapitel 5 · Lieferantenseite (LP-01, LA-01, Tests T5-01 bis T5-13)

| Test | Alte Seite | Inhalt | Neuer Ort |
|---|---|---|---|
| T5-01 | K-Start | „Dein nächster Schritt“: Zusage bestätigen | L5-Heute: Fokus oder Kurz prüfen; Bestätigen ist bindend und kommt als Fokus |
| T5-02 | K-Start | Aufgaben: Liefertreue erfassen | Kurz prüfen, aus Lieferscheinen vorausgefüllt |
| T5-03 | K-Start, B-Einladen | Kolleginnen einladen, Rechte je Person | L5-Akte, Team: „Person einladen“ als Blatt |
| T5-04 | K-Start | Geschäftsupdate für einen zweiten Kunden | eigene Akte je Kunde (Halder Maschinenbau) |
| T5-05 | K-Start | Deine Kunden | L5-Heute rechts und L5-Kunden |
| T5-06 | K-Arbeitsbereich | sechs Reiter | drei Sichten: Gemeinsam, Nur für dich, Von Hollmann |
| T5-07 | K-Arbeitsbereich | Nächster Schritt | „Als Nächstes“ in der Akte, je nach Zeitpunkt |
| T5-08 | K-Arbeitsbereich | Mit Hollmann geteilt: Spielregeln, Plan, Zusage, Scorecard | L5-Akte, Gemeinsam |
| T5-09 | K-Arbeitsbereich | Nur Rheintal: Kundenwert, interne Notiz | L5-Akte-Privat; die Notiz heißt „Mehr als 1,5 % nur mit Mengenzusage 2028“ (die alte Fassung schien Hollmanns Zielpreis vorauszusetzen) |
| T5-10 | K-Arbeitsbereich | Wo ihr gemeinsam steht | Mini-Spiegel Zusagen und Zusagenliste |
| T5-11 | K-JBP | Präsentation, Beiträge, Agenda, Teilnehmer, eigene Vorbereitung | L5-Termin |
| T5-12 | K-Beitrag | Beitrag schreiben | L5-Beitrag als Blatt, mit Entwurf und Hilfen |
| T5-13 | O-Einladung | Rolle wählen, Passkey | L5-Einladung: Rolle vorbelegt und änderbar, dann Passkey |

Nicht gezeichnet, in LP-01 beschrieben: Mein Agent und Einstellungen beim Lieferanten, Ansicht „Alles“ in Heute beim Lieferanten, Sicht „Von Hollmann“, Phasen „Im Termin“ und „Danach“ beim Lieferanten. Alle nutzen die Muster der Käuferseite. Die Claims-Boards bleiben unangetastet; das Modul ist aus (G-4).

## Kapitel 6 · Warengruppe und Strategie (ST-01, MV-01, MS-01, Tests T6-01 bis T6-14)

| Test | Alte Seite | Inhalt | Neuer Ort |
|---|---|---|---|
| T6-01 | WG-Aufsetzen | Team mit Rollen, Produktgruppen, Meilensteine | Teil 1 Rahmen und Ziele; Team auch an der Warengruppe |
| T6-02 | WG-Ziele | 7 Ziele in 5 Dimensionen, Ist, Soll, Termin, zurückgestellte Ziele mit Grund, Begründung der Auswahl | Warengruppe: Ziele; Teil 1 mit zurückgestellten Zielen und Begründung |
| T6-03 | WG-Intern | Umsatz je Produktgruppe und Business Unit, Mindestanforderungen, Unterscheidungsmerkmale | Teil 2 Lage, Abschnitt intern |
| T6-04 | WG-Lieferanten | Segmente, Umsatzverteilung, finanzielle Stabilität, Kapazität Vertrag und Abruf | Teil 2, Abschnitt Lieferanten; Anteile auch an der Warengruppe |
| T6-05 | WG-Markt | sechs Marktkräfte heute und in 3 bis 5 Jahren, Quellen, Bestätigung | Teil 2, Abschnitt Markt; laufend ergänzt durch Marktsignale |
| T6-06 | WG-Bewertung | Stärken, Schwächen, Chancen, Risiken; Paarungen mit Hebel; Hebelkatalog mit 23 Hebeln | Teil 3 Richtung; Katalog als Auswahl beim Hinzufügen eines Hebels (ab Kapitel 8: Hypothese, WT-01) |
| T6-07 | WG-Scorecard | Initiativen je Hebel mit Effekt, Ist, Soll, Verantwortlich, Termin | Teil 4 Umsetzung; Initiativen mit Wert auch im Wertkonto |
| T6-08 | WG-Vergaben | fünf Vergaben mit Zeitraum und Volumen, Prüffragen je Zieldimension | Teil 4 Umsetzung; Prüffragen füllt Reziproq beim Vorschlag eines Lieferanten; ab Kapitel 8 öffnet jede Vergabe als Objekt (VG-01) |
| T6-09 | WG-SupplierMap | Anteil Ist und Soll, Segment Ist, Soll-Typ, Beziehung laut Feedback, Matrix | Teil 3 Supplier Map; Balken an der Warengruppe; Matrix mit Soll-Markierung unter Beziehungen, Segmente |
| T6-10 | WG-Freigabe | Zusammenfassung, Gestaltung der Lieferantenbasis, Unterschriften, „Wofür die Strategie danach gilt“ | K6-Freigabe (Mappe) mit Folgen und Vorschau der Mandate |
| T6-11 | KI-Autor-Start | Daten vorhanden oder fehlend, was der Autor je Schritt tut, Rahmen | K6-Autor (Blatt) |
| T6-12 | KI-Autor | Entwurf prüfen: Stand je Schritt, was der Autor nicht entscheidet, Fragen ans Team, Lauf | K6-Strategie; dieselbe Seite für jede Warengruppe, auch Spritzguss |
| T6-13 | WG-Uebersicht (alt) | Gruppen „Brauchen dich“, „Freigegeben“, „Noch nicht begonnen“; Ergebnisse; Termine | Status je Warengruppe als Chip, Wert als Balken, Termine rechts |
| T6-14 | WG-Start (alt) | Phasen Analyse bis Freigabe, Kennzahlen, Team, Termine | Teile-Umschalter der Strategie; Kennzahlen im Kopf und unter Wert |

Nicht gezeichnet, in ST-01 und MV-01 beschrieben: Teile 1, 2 und 4 aufgeklappt, Mandat-Vorschläge für Saar Circuits, Donau Print und Moldau PCB, Strategie mobil. Die Leitfragen je Schritt stehen als Hilfe am jeweiligen Teil (Fragezeichen neben der Teilüberschrift).

## Kapitel 7 · Kanäle (KA-01, Tests T7-01 bis T7-06)

| Test | Alt | Inhalt | Neuer Ort |
|---|---|---|---|
| T7-01 | O-Outlook | Termin-Formular mit Teilnehmern und Hinweis zum Transkript | O-Outlook, Inhalt unverändert |
| T7-02 | O-Outlook | Add-in: Lieferant erkannt, Termintyp, Briefing 7 Tage vorher, Transkript, Agenda einfügen, als Aktivität speichern | Add-in-Bereich; Briefing 10 Tage vorher (wie Kapitel 3), „im Verlauf speichern“ statt „als Aktivität“ |
| T7-03 | O-Outlook | Weg 2: Eingangsadresse einladen, nur Absender der eigenen Domain | Hinweis im Add-in-Bereich und in der Notiz |
| T7-04 | O-Outlook | Unklare Termine landen in „Neu eingegangen“ in Heute | Zuordnung als Entwurf in Kurz prüfen; Heute, Ansicht Alles, Gruppe „Zuordnen“ (Kapitel 1) |
| T7-05 | O-Outlook | Mails ablegen per Add-in oder Weiterleitung an notizen@ | K7-Mail: Reziproq ordnet selbst zu; Weiterleiten bleibt möglich (Notiz) |
| T7-06 | Notiz „So kommt ein Termin nach Reziproq“ | Ablauf in vier Schritten, Begriff „Notizraum“ | Notiz „Kapitel 7 · Kanäle“ in fünf Schritten, Begriffe Verlauf und Kurz prüfen |

Nicht gezeichnet, in KA-01 beschrieben: Chat-Karte „Plan intern freigeben“, Kalender nach dem Termin, Benachrichtigungs-Mail an Lieferanten, Einstellungen je Nutzer für Kanäle.

