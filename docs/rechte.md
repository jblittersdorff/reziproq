# Rechte

Erzeugt aus `apps/api/src/modules/auth/permissions.ts` mit `pnpm rechte`. Nicht von Hand ändern.

Jeder Nutzer hat genau eine Rolle in seiner Organisation (PLT-05). Die Zusatzrolle Controlling
gibt später GuV-Wirkungen frei (PNL-06). Entschieden wird allein im Backend über `can()`.

| Aktion | Was | Admin | Nutzer | Leser | Betreiber |
| --- | --- | --- | --- | --- | --- |
| `organisation.sehen` | Organisation und Mitglieder sehen | ja | ja | ja | ja |
| `start.sehen` | Die eigene Startseite mit Aufgaben und Beziehungen sehen | ja | ja | ja | ja |
| `rollen.aendern` | Rollen, Controlling und Standardfunktion ändern | ja | nein | nein | nein |
| `einstellungen.verwalten` | Alle Einstellungen der Organisation öffnen | ja | nein | nein | nein |
| `lieferanten.sehen` | Lieferanten und Spend sehen | ja | ja | ja | ja |
| `lieferanten.bearbeiten` | Lieferant anlegen, ändern, beenden, Spend erfassen (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `team.festlegen` | Eigenes Team einer Beziehung festlegen (Käufer: Admin oder SRO; Lieferant: Admin oder Key Account Manager) | ja | ja | nein | nein |
| `verlauf.sehen` | Verlauf sehen | ja | ja | ja | ja |
| `prompt.nutzen` | Fragen an Reziproq stellen | ja | ja | ja | ja |
| `kunden.wechseln` | Als Betreiber in einen Kunden wechseln | nein | nein | nein | ja |
| `stammdaten.verwalten` | Business Units und Warengruppen anlegen, umbenennen, deaktivieren, löschen | ja | nein | nein | nein |
| `zuordnung.bearbeiten` | Lieferanten Business Units und Warengruppen zuordnen (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `segmentmodell.sehen` | Segmentmodell der eigenen Käuferorganisation ansehen | ja | ja | ja | ja |
| `segmentmodell.verwalten` | Segmentmodell der Organisation ändern und aktivieren | ja | nein | nein | nein |
| `runden.sehen` | Bewertungsrunden ansehen (Admin alle, SRO die eigenen Lieferanten, sonst nur Einladungen) | ja | ja | ja | ja |
| `runden.verwalten` | Bewertungsrunde anlegen, starten, verlängern und schließen | ja | nein | nein | nein |
| `runden.nachnominieren` | Bewertende nachnominieren (Admin, SRO nur für die eigenen Lieferanten) | ja | ja | nein | nein |
| `bewertungen.sehen` | Eigene Einladungen und die Bewertungen ansehen, die die Regeln der Runde freigeben | ja | ja | ja | ja |
| `bewertungen.abgeben` | Als bewertende Person Werte eintragen, Entwurf speichern und abgeben | ja | ja | nein | nein |
| `segmentierung.konsolidieren` | Ist und Soll eines Lieferanten festlegen (nur SRO der Beziehung und Admin) | ja | ja | nein | nein |
| `portfolio.sehen` | Portfolio mit Matrix und offenen Entscheidungen ansehen (nur Käufer) | ja | ja | ja | ja |
| `fokus.setzen` | Fokuslieferanten setzen und entfernen, mit Begründung (nur Käufer-Admin) | ja | nein | nein | nein |
| `zyklus.starten` | Zyklus eines Fokuslieferanten starten und JBP-Termin festlegen oder verschieben (Käufer-Admin oder SRO) | ja | ja | nein | nein |
| `lieferantenplan.bearbeiten` | Lieferantenplan verwalten und eigene zugewiesene Ziele bearbeiten | ja | ja | nein | nein |
| `lieferanten.einladen` | Personen des Lieferanten einladen und Einladungen zurückziehen (Admin oder SRO der Beziehung) | ja | ja | nein | nein |
| `kunden.sehen` | Als Lieferant die eigenen Kunden und ihre Arbeitsbereiche sehen (nur Geteiltes) | ja | ja | ja | ja |
| `spielregeln.sehen` | Kataloge für Spielregeln und Formate und die Vorschau je Typ sehen (nur Käufer) | ja | ja | ja | ja |
| `spielregeln.verwalten` | Rechte, Pflichten und Formate im Katalog anlegen und ändern (nur Käufer-Admin) | ja | nein | nein | nein |
| `spielregeln.festlegen` | Spielregeln einer Beziehung vorschlagen lassen, bearbeiten und intern freigeben (Admin oder SRO) | ja | ja | nein | nein |
| `termine.sehen` | Termine einer Beziehung sehen, auf beiden Seiten (geteilte und eigene) | ja | ja | ja | ja |
| `termine.bearbeiten` | Termine anlegen, Agenda, Protokoll, Beschlüsse und interne Notizen pflegen (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `massnahmen.sehen` | Maßnahmen einer Beziehung sehen, geteilte und die eigenen internen (beide Seiten) | ja | ja | ja | ja |
| `massnahmen.bearbeiten` | Maßnahmen anlegen, eigene bearbeiten und den Status ändern (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `kontaktpunkte.sehen` | Kontaktpunkte einer Beziehung sehen (Lieferant nur geteilte) | ja | ja | ja | ja |
| `kontaktpunkte.bearbeiten` | Kontaktpunkte anlegen, ändern, teilen und als geprüft markieren (Käufer, Admin oder Team, nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `kommentare.schreiben` | Objekte kommentieren, die man sieht, intern oder geteilt; eigene Kommentare 24 Stunden bearbeiten (beide Seiten) | ja | ja | ja | ja |
| `datenexport.anfordern` | Gesamtexport aller Daten der eigenen Organisation anfordern und 24 Stunden lang herunterladen | ja | nein | nein | nein |
| `hinweise.sehen` | Hinweise auf typische Fehler im Lieferantenmanagement sehen (nur Käufer) | ja | ja | ja | ja |
| `hinweise.entscheiden` | Hinweise annehmen (erzeugt eine interne Maßnahme) oder begründet verwerfen (SRO der Beziehung oder Admin) | ja | ja | nein | nein |
| `hinweise.einstellen` | Schwellwerte der Hinweis-Regeln einstellen | ja | nein | nein | nein |
| `suche.nutzen` | Lieferanten, Initiativen und Maßnahmen per Suchwort finden, nur im Sichtbaren (beide Seiten; Lieferant im aktuellen Kunden) | ja | ja | ja | ja |
| `warengruppen.sehen` | Warengruppen mit Team, Produktgruppen und Lieferanten sehen (nur Käufer) | ja | ja | ja | ja |
| `warengruppen.team` | Team und Produktgruppen einer Warengruppe pflegen (Admin oder Lead der Warengruppe) | ja | ja | nein | nein |
| `warengruppenstrategie.bearbeiten` | Warengruppenstrategie anlegen und bearbeiten (Lead und Commodity Manager alle Schritte, Einkauf im Team die Schritte 2 bis 9) | ja | ja | nein | nein |
| `warengruppen.segmentieren` | Bewertungsrunde je Warengruppe starten und das Segment in der Warengruppe festlegen (Lead, Commodity Manager, Admin) | ja | ja | nein | nein |
| `aktivitaeten.sehen` | Aktivitäten eines Lieferanten sehen: Termine, Notizen, Hinweise und Entwürfe von Reziproq (nur Käufer; private Notizen nur die Autorin) | ja | ja | ja | ja |
| `notizen.schreiben` | Notizen zu einem Lieferanten schreiben, für das Team oder nur für sich; ändern und löschen nur die eigenen (nur Käufer) | ja | ja | nein | nein |
| `teilung.vereinbaren` | Teilungsregel einer Initiative vorschlagen (Käufer: SRO oder Admin) oder bestätigen (Lieferant: Key Account Manager oder Admin) | ja | ja | nein | nein |
| `jbp.sehen` | Gemeinsamen Plan und seine Vorbereitung sehen (beide Seiten) | ja | ja | ja | ja |
| `jbp.anlegen` | Gemeinsamen Plan anlegen, mit Termin und Agenda (Käufer: Admin oder SRO) | ja | ja | nein | nein |
| `jbp.bearbeiten` | Eigenes Geschäftsupdate schreiben (beide Seiten, nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `wirkung.sehen` | GuV-Wirkung der Initiativen, Baseline und Reifegrad sehen (nur Käufer) | ja | ja | ja | ja |
| `wirkung.bearbeiten` | Wirkung einrichten, Baseline einfrieren, Reifegrad mit Nachweis erhöhen (nur Käufer, nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `wirkung.freigeben` | Wirkung freigeben oder mit Begründung zurückweisen (nur Käufer, nur mit Zusatzrolle Controlling) | mit Controlling | mit Controlling | mit Controlling | nein |
| `feedback.sehen` | Feedback-Wellen der Beziehung mit Rücklauf je Seite sehen (beide Seiten) | ja | ja | ja | ja |
| `eigene_sicht.bearbeiten` | Als Lieferant die eigene Sicht auf einen Kunden bearbeiten (nur Lieferantenseite) | ja | ja | nein | nein |
| `feedback.verwalten` | Feedback-Welle starten (Käufer: Admin oder SRO), eigene Teilnehmende einladen, eigene Seite abschließen | ja | ja | nein | nein |
| `mein_agent.einstellen` | In Mein Agent festlegen, wie viel Reziproq je Aufgabe für einen selbst tut (nur Käufer, MA-01) | ja | ja | nein | nein |

## Umbau KI-nativ (Planung)

Ergänzung aus dem Spec-Paket vom 24.11.2026 (`docs/entscheidungen.md`, Specs ab ZA-01). Sie geht den
Abschnitten zu Warengruppenmanagement, KI und Anbindungen unten vor; Zeilen zu eigenen Agenten entfallen.
Klärungen aus K0: „Lead“ einer Beziehung ist der Lead ihrer Haupt-Warengruppe, mit Vertretung (E-K0-07);
beim Lieferanten heißt die Teamrolle `sro` Key Account (E-K0-08); das Controlling bestätigt per Link oder
mit Konto (E-K0-12).

Grundsatz: Ein Lauf von Reziproq handelt immer mit den Rechten einer Person und nie über deren Stufe in Mein Agent hinaus; ein Mandat kann die Stufe nur senken.

### Räume

| Raum | Käuferseite | Lieferantenseite | Gast per Link |
|---|---|---|---|
| `buyer_private` | lesen und schreiben je Rolle | nie | nie |
| `shared` | lesen; schreiben je Rolle; bindend nur mit Token | lesen; schreiben je Rolle; bindend nur mit Token | nur die Objekte des Links |
| `supplier_private` | nie | lesen und schreiben je Rolle | nie |

Durchgesetzt mit Row Level Security in der Datenbank. Suche, Frag Reziproq, Exporte, Links und Agent-Kontext unterliegen denselben Regeln.

### Rollen Käuferseite

| Handlung | Admin | Lead | SRO | Mitglied | Leser |
|---|---|---|---|---|---|
| KI-Einstellungen der Organisation, Kanäle, Kostensätze Reibung (Startwerte) | ja | – | – | – | – |
| Beziehungsrendite einschalten (E-K4-2) | ja | – | – | – | – |
| Transkript-Aufbewahrung 30, 90 oder 180 Tage (E-K3-7) | ja | – | – | – | – |
| Mein Agent (eigene Stufen) | ja | ja | ja | ja | – |
| Zusage im Namen des Käufers freigeben | ja | ja | ja | ja | – |
| Agenda und Protokoll teilen | ja | ja | ja | ja | – |
| Wirkung freigeben | ja | ja | ja | – | – |
| Mandat bestätigen oder ändern | ja | ja | ja (eigene Beziehung) | – | – |
| Deal im Mandat senden oder bestätigen | ja | ja | ja (eigene Beziehung) | – | – |
| Deal außerhalb des Mandats annehmen (E-K5-2) | – | ja (oder Vertretung) | – | – | – |
| Strategie freigeben festhalten (E-K6-2) | – | Lead der Warengruppe | – | – | – |
| Strategie-Teil bestätigen (E-K0-28) | – | ja (Lead der Warengruppe) | – | ja (Commodity Manager im Team) | – |
| Reibungs-Kostensätze ändern (E-K4-3) | – | ja | – | – | – |
| Wertbericht senden | ja | ja | – | – | – |
| Anteile einer Warengruppe entscheiden (E-K8-3) | – | Lead der Warengruppe (oder Vertretung) | – | – | – |
| Verhandlungsrahmen freigeben, Anfragen senden | ja | ja | – | ja (Commodity Manager der Warengruppe) | – |
| Vergeben (E-K8-3) | – | Lead der Warengruppe (oder Vertretung) | – | – | – |
| Review-Vorlage senden, Beschlüsse festhalten | – | Lead der Warengruppe | – | – | – |
| Hypothese bearbeiten, Sicherheit anheben bestätigen | ja | ja | ja (verantwortlich) | ja (verantwortlich) | – |
| Demo-Regie (nur im Demo-Mandanten) | ja | ja | ja | ja | ja |

Den Gemeinsamen Plan gibt intern der Sponsor der Beziehung frei (im Demo Mara Weiß), unabhängig von der Rolle in der Tabelle. Controlling bestätigt Wert per Link mit Token (E-K4-1); ein Konto ist optional.

### Rollen Lieferantenseite (ab Kapitel 5)

| Handlung | Sponsor | Key Account | Mitglied |
|---|---|---|---|
| Deal senden oder bestätigen | ja (oder nach eigener Freigaberegel, E-K5-3) | ja, wenn die Freigaberegel es erlaubt | – |
| Kostenspanne teilen oder zurückziehen | ja | ja | – |
| Plan freigeben | ja | – | – |
| Zusagen bestätigen | ja | ja | ja (eigene) |
| Beiträge senden | ja | ja | ja (eigene) |
| Person einladen | ja | ja | – |
| Vorlagen anlegen (E-K5-5) | ja | ja | – |
| Verhandlung durch den eigenen Agenten zulassen, Untergrenze setzen (E-K8-6) | ja | ja | – |
| Angebot auf eine Anfrage bestätigen | ja | ja, wenn die Freigaberegel es erlaubt | – |

Bestätigen per Link (ohne Konto): Passkey, an die Person gebunden, 14 Tage (E-K2-6); zeigt nur die Objekte des Links.

### Nie, für niemanden

- Daten aus einer Kundenakte in einer anderen Kundenakte, auch nicht über den Agenten oder eine Vorlage (E-K5-5).
- Personenbezogene Stunden oder Leistungsauswertungen (E-K4-2).
- Wertarten addiert (G-3).
- Bindende Handlung über einen Kanal gegenüber Lieferanten (KA-01).
- Namen, Preise, Bedingungen oder Rang eines Bieters gegenüber einem anderen Bieter, auch nicht über Agenten (VG-01).
- Soll-Kosten, Verhandlungsrahmen oder Hypothesen beim Lieferanten (WZ-01, VG-01, WT-01).

## Warengruppenmanagement (Zielmatrix)

Die Rollen Lead, Commodity Manager, Einkauf im Team und Funktion im Team gelten je Warengruppe (`category_member.role`).

| Objekt | Admin | Lead | Commodity Manager | Einkauf im Team | Funktion im Team | SRO der Beziehung | Käufer mit Zugriff | Lieferant |
|---|---|---|---|---|---|---|---|---|
| Warengruppe, Produktgruppe, Team | schreiben | Team und Produktgruppen schreiben | lesen | lesen | lesen | lesen | lesen | nie |
| Strategie im Entwurf | lesen | schreiben | schreiben | Schritte 2 bis 9 schreiben | zugewiesene Sichten kommentieren | nur Zeile seines Lieferanten in der Supplier Map | nie | nie |
| Strategie freigegeben | lesen | lesen | lesen | lesen | lesen | lesen | lesen | nie |
| Kostensicht | lesen | schreiben | schreiben | schreiben | nie | nie | nie | nie |
| Bewertungsrunde der Warengruppe | lesen | starten, entscheiden | starten, entscheiden | bewerten | bewerten | lesen | lesen | nie |
| Freigabe | Wege einstellen | vorlegen, unterschreiben | unterschreiben | lesen | lesen | lesen | lesen | nie |
| Zusammenführung, Widersprüche | lesen | Widersprüche seiner Warengruppe lösen | Widersprüche lösen | lesen | nie | Gesamtsegment entscheiden, Widersprüche lösen | lesen | nie |
| KI-Entwurf | Einstellungen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie | wie Zielobjekt | nie | nie |

Freigebende nach Freigabeweg lesen die ganze Strategie im Entwurf einschließlich Kostensicht und geben frei oder zurück.

Für alle Tabellen des Moduls gilt:

- Art `org_private`, keine Freigabe-Policy.
- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.
- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.

## KI und Agenten (Planung)

Vorgabe für die Umsetzung. Offene Rollenfragen stehen im [Prüfbericht](eingang/PRUEFBERICHT.md).

| Objekt | Admin | Besitzer eines eigenen Agenten | SRO der Beziehung | Käufer mit Zugriff | Lieferant |
|---|---|---|---|---|---|
| Einstellungen KI | schreiben | lesen | lesen | Kontingent lesen | nie |
| Verbrauch je Agent | lesen | eigene Agenten lesen | lesen | nie | nie |
| Agent von Reziproq | ein- und ausschalten | lesen, starten | lesen, starten | lesen, starten | nie |
| Eigener Agent | freigeben, pausieren | schreiben, testen, löschen | lesen, starten | lesen, starten, wenn die Daten sichtbar sind | nie |
| Lauf und Protokoll | Metadaten aller regulären Läufe, Inhalte mit Quellenzugriff | eigene Läufe mit Quellenzugriff | eigene Läufe mit Quellenzugriff | eigene Läufe mit Quellenzugriff | nie |
| Entwurf | lesen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie |
| Wertpotenzial, Rechenweg, Marktsignal, Datenlücke | lesen | – | übernehmen, verwerfen, Annahmen ändern | lesen, wenn Zugriff auf die Beziehung | nie |
| Frage an das Team | lesen | – | – | beantworten, wenn an sie gerichtet; Lead und Commodity Manager alle | nie |

KI-03 speichert Aussagen und Quellen in der Käuferorganisation. Die Fachberechtigung des Zielobjekts gilt auch für Übernahme, Bearbeitung und Verwerfen. QBR-07 führt die eigene Lieferantenvorbereitung getrennt in der Lieferantenorganisation weiter.

Manuelle Systemläufe handeln mit den Rechten der startenden Person. Bei späteren Fremdstarts eigener Agenten gilt die Schnittmenge der Rechte von Starter und Besitzer. Testläufe sieht ausschließlich die startende Person mit Zugriff auf die Quelle.

Für alle Tabellen aus KI-01 bis KI-13 gilt:

- Art `org_private`, keine Freigabe-Policy.
- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.
- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.
- Ein Werkzeug liefert nie mehr, als die Person sehen darf, in deren Namen der Lauf handelt.

Ergänzung ab KI-15:

| Objekt | Admin | Lead | Commodity Manager | SRO der Beziehung | Käufer mit Zugriff | Controlling | Lieferant |
|---|---|---|---|---|---|---|---|
| Import, Alias, Regel | schreiben, rückgängig | lesen | Prüfung für eigene Warengruppen | – | – | – | nie |
| Hinweis (Ergänzung zu FS-01) | Regeln und Schwellen | alle lesen | eigene Warengruppen bearbeiten | eigene Beziehungen bearbeiten | – | – | nie |
| Ergebnisse nach dem Termin | – | – | – | übernehmen, Protokoll teilen | Teilnehmer: erfassen, lesen | – | nur geteiltes Protokoll und geteilte Zusagen |
| Dokument, Feld | löschen | lesen | eigene Warengruppen schreiben, bestätigen | schreiben, bestätigen | lesen | – | nie |
| Vertragsleck, Bestellzeile, Gutschrift | lesen | lesen | eigene Warengruppen lesen | klären, Rückfluss erfassen | – | Rückfluss bestätigen | nur gesendete Klärung |
| Szenario | lesen | entscheiden | eigene Warengruppen schreiben, entscheiden | schreiben, entscheiden ohne Warengruppe | lesen | – | nie |
| Verhandlungsplan, Probe | – | lesen | – | schreiben | nur Mitglieder | – | nie |
| Quartalsbericht | anlegen | anlegen, freigeben, exportieren | lesen | lesen | freigegebene lesen | freigegebene lesen | nie |
| Hilfe für Lieferanten | ein- und ausschalten, Verbrauch je Lieferant | – | – | – | – | – | eigene Läufe und Entwürfe |

## Anbindungen (Planung)

Vorgabe für die Umsetzung. Offene Rollenfragen stehen im [Prüfbericht](eingang/PRUEFBERICHT.md).

| Recht | Admin | SRO | Commodity Manager | Käufer | Lieferant |
|---|---|---|---|---|---|
| `integration.manage` | ✓ | – | – | – | – |
| `integration.connect_own` (Kalender, Add-in) | ✓ | ✓ | ✓ | ✓ | – |
| `inbound.assign` (eigene Eingänge) | ✓ | ✓ | ✓ | ✓ | – |
| `inbound.assign_relationship` (Eingänge zu eigenen Lieferanten) | ✓ | ✓ | – | – | – |
| `mail.file` | ✓ | ✓ | ✓ | ✓ | – |
| `transcript.settings` | ✓ | – | – | – | – |
| `transcript.opt_in` (je Termin) | – | ✓ | – | Organisator | – |
| `transcript.read_raw` | – | ✓ | – | nach Freigabe | – |
| `api_key.manage` | ✓ | – | – | – | – |

Regeln: Daten aus Anbindungen sind immer `org_private`. Der Lieferant sieht nur, was ein Mensch teilt.
