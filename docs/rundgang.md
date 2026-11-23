# Rundgang: Was ist gebaut und wo sehe ich es

Stand 23.11.2026, nach Schritt 10 der Warteschlange ([umsetzungsplan.md](umsetzungsplan.md)).
Diese Datei wird mit jedem Schritt fortgeschrieben.

## Vorbereitung

1. `pnpm dev` läuft (App unter http://localhost:5173).
2. Einmal `pnpm demo:setup`. Das richtet die Beispieldaten auf deine Konten ein und legt eine
   Demo-Geschichte an: Der Test-Lieferant und der Lieferant mit dem größten Spend werden
   Fokuslieferanten mit Gemeinsamem Plan, Initiativen, Zusagen, Scorecard, einem QBR in sieben Tagen,
   Jahresziel 600.000 € und Ziel 400.000 € für den Test-Lieferanten. Danach laufen einmal der
   Wertpotenzial-Finder und die QBR-Vorbereitung. Ein zweiter Aufruf ändert an der Geschichte nichts.
3. Als **OEM 1** anmelden (Käufer, Admin). Für die Lieferantensicht als **Lieferant 1**.

KI läuft lokal mit dem Testanbieter: feste Antworten, keine Kosten, kein Netzwerk. Marktsignale
kommen aus festen Testquellen.

## Als Käufer (OEM 1)

| Wo                                                          | Was du siehst und tun kannst                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Übersicht** (`/uebersicht`)                               | Aussage von Reziproq („Gesichert sind … % des Jahresziels“) mit Quellen und „Stimmt nicht“. Ringpaar: außen gesichertes EBIT gegen das Jahresziel, innen Fokuslieferanten mit freigegebenem JBP. Drei Sätze: Was gut läuft, Was hakt, Was ihr tun solltet. Zeilen In Umsetzung, Cash, Wertpotenziale. Drei Fragevorschläge. |
| **Mein Tag** (`/mein-tag`)                                  | Die Aufgabe „QBR vorbereiten: Entwürfe prüfen“ aus der QBR-Vorbereitung.                                                                                                                                                                                                                                                    |
| **Lieferanten** (`/lieferanten`)                            | Liste mit Detailleiste rechts. Test-Lieferant (Demo) öffnen.                                                                                                                                                                                                                                     |
| Lieferant › **Überblick**                                   | Aussage, Ringpaar (gesichert gegen Ziel 400.000 €, Zusagen rechtzeitig eingehalten), Karte „Größte Chance“.                                                                                                                                                                                                                 |
| Lieferant › **Aktivitäten**                                 | Notizen (Team oder nur ich), Termine, Einträge von Reziproq.                                                                                                                                                                                                                                                                |
| Lieferant › **Plan**                                        | Gemeinsamer Plan (freigegeben), Zusagen (eine überfällig), Scorecard (Liefertreue hinter Plan, Fortschritt von der Basis zum Ziel).                                                                                                                                                                                         |
| Lieferant › Aktivitäten › **Termine** › Quartalsreview             | Bereich „Interne Vorbereitung von Reziproq“: Themen, Risiken, offene Punkte mit Quellen. Übernehmen, Verwerfen, „Neu vorbereiten“. Ein übernommenes Thema mit „In die Agenda“ geht nur als Titel in die geteilte Agenda.                                                                                                    |
| Lieferant › **Ergebnisse** › P&L-Brücke                     | Bestätigte Ergebnisse der Initiativen.                                                                                                                                                                                                                                                                                      |
| Lieferant › Ergebnisse › **Wertpotenziale**                 | Preisgleitklausel nach Index: Wert für euch, Wirkung für den Lieferanten, Sicherheit mit Grund, Rechenweg (aufklappen). Annahmen ändern, Als Thema ins JBP übernehmen, Verwerfen. Rechts: was geprüft wurde, Marktsignale mit Ergebnis, was nach außen ging, Datenlücken mit „Anfrage entwerfen“.                           |
| **Wertpotenziale über alle** (`/uebersicht/wertpotenziale`) | Summen je Wirkungsart, größtes Potenzial, Spannen-Balken und Tabelle je Lieferant, häufigste Hebel, Signale und Datenlücken.                                                                                                                                                                                                |
| Profil › Einstellungen › **KI und Agenten**                 | Verarbeitung nur in der EU, öffentliche Recherche, Budget je Monat und Lauf, Segmente für den monatlichen Wertpotenzial-Lauf, Annahmen der Hebel-Vorlagen, Verbrauch des Monats. Darunter die Agenten mit Läufen und Protokoll.                                                                                             |

## Als Lieferant (Lieferant 1)

Der Lieferant sieht den Gemeinsamen Plan, geteilte Zusagen, Termine und Agendapunkte. Er sieht nie
Wertpotenziale, Rechenweg, Marktsignale, Datenlücken, interne Vorbereitung, Aussagen oder Ziele.
Nur was ihr ausdrücklich teilt, zum Beispiel ein übernommenes Thema oder eine gesendete
Datenanfrage (als Maßnahme), erscheint bei ihm.

## Was die Demo noch nicht zeigt

- Feedback-Umfrage und Hantel (keine Umfrage in den Demo-Daten)
- Anbindungen (Schritt 12, in Arbeit)
- Hinweise mit Bewertung, Import und Ergebnisse nach Terminen (KI-15 bis KI-17, Specs fehlen)
- Anpassungen der Warengruppen (Schritte 21 bis 33, nach dem Lieferantenmanagement)
