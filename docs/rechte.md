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

## Geplant: Warengruppenmanagement (Release 1.1, noch nicht umgesetzt)

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
