# Prüfbericht · 22. November 2026

Alle sieben Bundles liegen vor. Von 31 unterschiedlichen Spec-Kennungen sind **7 OK**, **3 Kleinigkeit** und **21 Konflikt**. Die zwei Fassungen von WG-23 zählen einmal. WG-startdaten und Designsprache sind ergänzende Unterlagen. Fehlende KI-Anforderungen zählen nicht als eingegangene Specs.

Geprüft gegen die lokalen Specs, Glossar, Rechte, Umsetzungsplan und den Code auf `d20ed66` einschließlich der Migrationen bis 0087. OK bezeichnet einen konsistenten Auftrag, auch wenn seine Umsetzung noch aussteht. Konflikt verlangt eine fachliche Entscheidung oder eine fehlende Spezifikation. Die [Warteschlange](../umsetzungsplan.md) hält solche Voraussetzungen ausdrücklich offen.

## Eingang und Abdeckung

- Verwendet wurde `reziproq-specs-warengruppen-2` vom 22.11. Die ältere Lieferung vom 15.11. liegt unter [alt/reziproq-specs-warengruppen](alt/reziproq-specs-warengruppen/). Nur dort und in der bisherigen Arbeitsfassung von WG-15 steht das alte Feld. WG-15 und WG-18 der neueren Lieferung haben kein `relationship_mode`.
- Die sechs übrigen Bundles liegen jeweils einmal vor. Das Designbundle enthält Designsprache und Referenzen, aber keine LIESMICH. Die Ablage folgt dafür dem Auftrag. Die LIESMICH des KI-Bundles bestimmt die jüngere fachliche WG-23-Fassung. Das WG-Bundle liefert auch die bereits gebauten oder unveränderten WG-Specs mit.
- KI-01 bis KI-14 verteilen sich auf acht Dateien; für KI-15 bis KI-23 gibt es weder eine Datei noch eine Abdeckungszeile. KI-18 ist für spätere Dokumente, KI-22 für den späteren Export erwähnt. Für KI-19–21 und KI-23 ist kein Umfang geliefert. Die LIESMICH der Anbindungen nennt sieben **Specs**; deren „deckt ab“ verteilt die **Anforderungen** IN-01 bis IN-08 auf diese sieben Dateien. AW-02/03 und WG-02/03 usw. sind ebenfalls gebündelte Anforderungen.
- Referenzseiten und Specs sind in Arbeitskopien abgelegt. Bei gleichem Zielnamen blieb der Bestand erhalten, auch bei gleichem Inhalt. Eine weitere inhaltlich andere Kollision trägt `.neu2`; bei HTML bleibt die Endung `.dc.html` erhalten. Das E2E-Konzept-PDF lag separat unter docs/ und gehört keinem der sieben Bundle-Ordner an.

## Befund je Spec

| Spec | Status | Begründung und Fundstelle |
|---|---|---|
| [NAV-10](../specs/NAV-10.md) | Konflikt | „Release“, „Übersicht“, „Daten“: NAV-10/11/12 bereits als Anforderungen belegt, user_setting fehlt, Übersicht verlangt KI und offene WG-Ziele vor deren Lieferung (F1–F3). |
| [LS-01](../specs/LS-01.md) | Konflikt | „Wer darf was“, „Daten“: supplier fehlt als Stammtabelle; Import bislang auch für Nutzer, Spend kann mehrere Währungen haben (PLT-07, suppliers.service.ts; F4). |
| [AW-01](../specs/AW-01.md) | Konflikt | „Fakten und Aussage“ und Abnahme: andere Agentenkennung und Taktung als NAV-10, benutzerabhängige Fakten in organisationsweitem Cache, KI-16 fehlt (F1–F3). |
| [KI-01](../specs/KI-01.md) | OK | Gateway übernimmt Aufrufe aus PLT-12 und den Fachmodulen; org_setting ist erweiterbar (0063, 0080). EU-Region, Kosten und Monatsgrenze mit fake messbar. |
| [KI-03](../specs/KI-03.md) | Konflikt | „Daten“, „Wer darf was“: Entwürfe und Quellen existieren mit anderen Status, Typen und optionalem Entwurfsbezug; QBR-07 kennt lieferanteneigene Entwürfe (0074–0077, 0085; F5). |
| [KI-04](../specs/KI-04.md) | Konflikt | „Daten“, „Lauf“: globale Vorlage mit leerer org_id als org_private; Fremdstart und Protokollzugriff passen nicht durchgehend zu KI-09 bzw. zur Rechtematrix (F5). |
| [KI-07](../specs/KI-07.md) | Konflikt | „Auslöser“, „Ergebnis“: QBR sieben Tage vorher, IN-03 verlangt Briefings weiterer Termintypen mit Vorlauf und Agenda. Ersetzung je Beziehung gefährdet den Entwurf eines zweiten Termins (F6). |
| [KI-08](../specs/KI-08.md) | Kleinigkeit | „Fertig, wenn“: Quellenprüfung sprachlich berichtigt. Erweitert WG-09 (0085) um den Agenten; Leserecht auf Kostendaten hängt an der Entscheidung zu WG-07 (F9). |
| [KI-09](../specs/KI-09.md) | Konflikt | „Eigener Agent“: Besitzerrechte bei Fremdstart gegenüber Starterrechten aus KI-04; Sicht auf Ergebnis und Verhalten bei teilweisem Rechteverlust offen (F5). |
| [KI-11](../specs/KI-11.md) | Konflikt | „Sicherheit“: Regeln überschneiden sich; für geänderte Nutzerannahmen oder ausschließlich alte eigene Eingaben fehlt ein eindeutiges Ergebnis. PNL-01 hat bereits versionierte Hebel (F7). |
| [KI-13](../specs/KI-13.md) | Konflikt | Schritt 9 entwirft „Segment Soll, Beziehung“; WG-15 führt nur den Soll-Typ und die lesbare Feedback-Lücke. Der Zielort für den zusätzlichen Vorschlag ist offen (F8). |
| [IN-01](../specs/IN-01.md) | OK | Registry, verschlüsselte Secrets und idempotente Ereignisse sind neue Objekte; in „Schreiben“ und „Fertig, wenn“ sind Käufer-Domänendienst, Mandant und Lieferantentrennung ausdrücklich prüfbar. |
| [IN-02](../specs/IN-02.md) | Konflikt | „Daten“, „Anmeldeseite“: provider + subject und Domain-Erstanlage treffen auf app_user mit Zitadel-sub und einen konfigurierten Issuer; Datenebene der Identität offen (F10). |
| [IN-03](../specs/IN-03.md) | Konflikt | „Daten“ und „Neu eingegangen“: meeting und Teilnehmer sind geteilt (0040), neue Rohdaten privat. Abgesagt, Mehrfachzuordnung und Nicht-Lieferant passen nicht zum Bestand (F6). |
| [IN-04](../specs/IN-04.md) | Konflikt | „Doppelte Mails“, „Nur ich“: message_id allein kann private Ablagen verschiedener Personen oder Kunden zusammenziehen; KI-18 fehlt für document_id (F1, F11). |
| [IN-05](../specs/IN-05.md) | Konflikt | „Wer darf was“ gibt Organisatoren Rohtextzugriff; Matrix erlaubt ihn außerhalb SRO nur nach Freigabe. KI-17 und meeting_capture fehlen (F1, F11). |
| [IN-06](../specs/IN-06.md) | Konflikt | Startwerte enthalten Transkripterinnerung ohne passenden kind; Sofort-Hinweise benötigen KI-16, Ergebnismeldungen KI-17. Fallback bei ausgeschalteter Mail offen (F1, F11). |
| [IN-07](../specs/IN-07.md) | Konflikt | „Daten“ und „Lieferungen“ erweitern import_batch aus der fehlenden KI-15. PLT-07 hat Vorschau und Übernahme, aber keinen solchen persistenten Stapel (F1, F12). |
| [WG-01](../specs/WG-01.neu.md) | Konflikt | „Daten“ fordert Pflicht-Warengruppe am Spend und neue category_supplier-Zeilen trotz optionalem Spend und bestehender käuferprivater Zuordnung in 0080 und WG-01 „Vorarbeit“ (F8). |
| [WG-04](../specs/WG-04.neu.md) | Kleinigkeit | „Fertig, wenn“ ließ die Ausnahmen für berechtigte Leser aus. Negativfall präzisiert; Strategie, Fragen und Notizen sind in Migration 0081 vorhanden. |
| [WG-06](../specs/WG-06.neu.md) | Kleinigkeit | „Daten“ verlangt quartalsweise Portal-Ist-Werte, WG-06 „Umsetzung“ belegt bisher manuelle Eingabe. Abnahmekriterium für die bereits geforderte Aktualisierung aus vorhandener Portalquelle ergänzt. |
| [WG-07](../specs/WG-07.neu.md) | Konflikt | „Wer darf was“ nennt das Team einschließlich Funktion für Kosten. Rechte-Zielmatrix schließt Funktion aus, wg-07.test.ts prüft heutigen Zugang. Auch Sichtzuweisung fehlt (F9). |
| [WG-09](../specs/WG-09.neu.md) | OK | Manuelle Marktkräfte, bestätigte Werte und Quellen liegen in 0085; eingebauter synchroner Entwurf ist dokumentiert. Die Agentenausführung ist als Anpassung über KI-08 geplant. |
| [WG-10](../specs/WG-10.neu.md) | OK | Paarungen, Begründung und Status sind in 0086/0087 und wg-10.test.ts belegt. Geplante Admin-Oberfläche und KI-Vorschläge bauen auf dem bestehenden Katalog auf. |
| [WG-12](../specs/WG-12.neu.md) | OK | „Daten“ trennt private Warengruppeninitiativen von JBP und Impact-Ledger; Ziel, Hebel, Reviewtermin und Lieferantenfilter sind prüfbar. Endabnahme mit der Freigabe WG-16. |
| [WG-14](../specs/WG-14.neu.md) | OK | Vergaben und Bündel sind zusätzliche private Objekte. Die Warnung „beendet“ ist mit WG-15 und die übergreifende Regel mit WG-20 prüfbar. |
| [WG-15](../specs/WG-15.neu.md) | Konflikt | „Daten“, „Fertig, wenn“: neues Zielsegment mit Zieljahr in der Map; die gebaute WG-18-Entscheidung speichert schon Ist und Soll. Ein gemeinsamer Schreibweg fehlt (F8). |
| [WG-16](../specs/WG-16.neu.md) | OK | „Freigabeweg“ und „Fertig, wenn“ legen vier Wege und Versionierung fest; die bestehende Eindeutigkeit in 0081 enthält bereits die Version. Schwellenwerte als Testdaten setzen. |
| [WG-18](../specs/WG-18.neu.md) | Konflikt | „Daten“, „Portfolio“: Segmententscheidung als org_private statt buyer_private, Soll bisher in SEG, künftig WG-15; alter Filterpfad weicht von Code und NAV-10 ab (F8). |
| [WG-20](../specs/WG-20.neu.md) | Konflikt | „Wer darf was“ führt Commodity Manager für die Konfliktlösung nicht auf, die Rechte-Zielmatrix schon. Entwurfssicht und Weitergabe an den Lieferantenplan begrenzen (F9). |
| [WG-23](../specs/WG-23.neu.md) | Konflikt | KI-Fassung nutzt KI-03/04, WG-Fassung definiert Tabellen selbst und enthält zusätzlich „Fragen“. Beide verlangen einen Beziehungsentwurf ohne editierbares Zielfeld (F5, F8). |

**Ergänzende Unterlagen.** WG-startdaten.neu.md entfernt die vier alten Beziehungswerte. Im neuen Hebelkatalog fehlen die 23 Dimensionszuordnungen aus der bisherigen Datei und dem Seed (F8). Die Designsprache ergänzt Informationsdichte, Ringe und Diagramme. Abweichungen der HTML-Vorlagen stehen weiter unten.

## Entscheidungen vor der Umsetzung

1. **F1 · Umfang und Reihenfolge.** Werden KI-15 bis KI-23 nachgeliefert, oder welche entfallen? Ohne KI-15 fehlen Importprüfung und Stapel für IN-07, ohne KI-16 Bewertung und Schwere der Hinweise für NAV-10, AW-01 und IN-06, ohne KI-17 Terminergebnisse für IN-05. KI-18 ist für die Dokumentverknüpfung nachgelagert, KI-22 für den Export ausdrücklich außerhalb von AW-01. Dürfen NAV-10, LS-01 und AW-01 zuerst mit den gebauten Quellen starten und ihre KI-, Integrations- und WG-Teile beim jeweiligen Fachschritt abnehmen? Andernfalls kann die feste Reihenfolge nur Arbeitsbeginn, nicht Fertigstellung meinen. Der Plan zeigt den Teilungsvorschlag. Soll die öffentliche Release-Nummer 1.1 den Warengruppen gehören oder wie in den älteren Planentscheidungen den Lieferanten-Erweiterungen? K1–K3 und I1 sind vorerst Paketnamen.
2. **F2 · Navigation und Kennungen.** Soll NAV-10 die bisherigen Anforderungen NAV-10 (PLT-10/UMB-05), NAV-11 (PLT-12) und NAV-12 (bestehende Filter) ausdrücklich fortschreiben oder eigene neue Anforderungsnummern erhalten? Die Spec-Datei NAV-10 war frei. Für die Startseite fehlt die in NAV-10 vorausgesetzte Tabelle user_setting. Soll die Präferenz wie die Sprache an der Person liegen oder je Organisation gelten? Soll jeder WG-Lead ein organisationsweites EBIT-Ziel pflegen dürfen oder braucht es eine eigene Leitungsrolle? Die persönliche Startwahl und die Zahlensicht müssen auch ohne Admin-Zugang zu den Organisationseinstellungen funktionieren.
3. **F3 · Aussagen der Übersicht.** Gilt ein gemeinsamer Agent insight_summary mit Faktenänderung und Stundenlimit oder ein eigener overview_summary mit Tageslauf und Neuberechnung nach Controlling-Freigabe? Darf die Übersicht drei Karten haben, wie NAV-10 und der Ablauf von AW-01 vorsehen, oder gilt das Abnahmelimit von zwei? Soll bei Ziel gleich Basis der Fortschrittsbalken entfallen oder soll die Zielerreichung als erfüllt / offen erscheinen? Sollen Lesende dieselbe Zusammenfassung nur für identische sichtbare Fakten teilen dürfen, oder soll sie pro Person gespeichert werden? Der vorgeschlagene Schlüssel in AW-01 enthält keinen Sichtbarkeitsumfang der Person. Fakten, Text, Links und Quellen müssen auch nach Rechteentzug erneut geprüft werden.
4. **F4 · Lieferantenliste.** Ist der Kurzname global am Lieferanten (organization) oder käuferprivat je Beziehung (relationship_side)? Bleibt der Import für Nutzer aus PLT-07 oder wird er auf Admins eingeschränkt? Darf nur der Admin beendete Beziehungen sehen? suppliers.service.ts liefert sie heute im Ergebnis mit. Sollen Fremdwährungen getrennt gezeigt oder nach einer vorgegebenen Kursregel in EUR umgerechnet werden? Für einen spendbasierten Hauptwarengruppennamen fehlen die Regel bei Gleichstand und der Umgang mit nicht zugeordnetem Spend.
5. **F5 · KI-Rechte und Bestand.** Bleibt der getrennte Lieferanten-Pre-Read aus QBR-07 erhalten, oder soll er auslaufen? Sollen Bestandsentwürfe/-quellen mit einer Migration in KI-03 übergehen oder als Altformat lesbar bleiben? Dürfen Administratoren bzw. Besitzer vollständige Protokolle von Läufen anderer sehen oder nur Metadaten und einzeln berechtigte Inhalte? „Nur ich“ aus NAV-10/IN-04 gilt auch für daraus abgeleitete Entwürfe, Quellen und Suchtreffer. Bei Fremdstart eines eigenen Agenten kommen Starterrechte oder die Schnittmenge aus Starter- und Besitzerrechten in Betracht. Sollen Systemagenten mandantenweise instanziiert oder als globale Vorlagen mit privater Aktivierung geführt werden? Eine leere org_id passt nicht zur gewöhnlichen org_private-Policy.
6. **F6 · Termine und Briefings.** Sollen neue Kalendertermine interne Zeilen mit getrennten privaten Importdetails sein, oder eigenständige private Eingänge, die erst nach ausdrücklicher Freigabe einen geteilten QBR-Termin erzeugen? Welches Modell gilt für einen Termin mit zwei Lieferanten oder ohne Beziehung, für Absagen und zusätzliche Termintypen? 0040 fordert genau eine Beziehung und kennt weder „abgesagt“ noch alle Add-in-Typen. Darf KI-07 nur QBR sieben Tage vorher vorbereiten oder alle ausgewählten Termintypen mit eigenem Vorlauf und Agenda? Ersetzt ein neuer Lauf den Entwurf zum Termin oder jeden offenen Entwurf der Beziehung? Darf ein Team-Leser Termine per Add-in schreiben, obwohl ihm termine.bearbeiten heute fehlt?
7. **F7 · Sicherheit von Potenzialen.** Welche Stufe gilt bei konkurrierenden Regeln, einer user_assumption und ausschließlich älteren internen Daten? Soll jeweils die vorsichtigste Stufe gelten oder eine explizite Entscheidungstabelle? Vorher haben die Tests „Die Sicherheit folgt der Regel“ und die EBIT-Summe in AW-01 für diese Fälle keinen eindeutigen Sollwert.
8. **F8 · Warengruppen und SEG.** Bleiben die am 16.11. beschlossene optionale Spend-Zuordnung und die käuferprivate SEG-Entscheidung bestehen, oder ist eine Überführung in die neue Datenebene bzw. Pflichtzuordnung gewollt? Soll der Zieltyp aus der Runde in die Supplier Map übernommen werden oder sind bewertetes Soll und strategischer Soll-Typ getrennte, beschriftete Ziele? Soll die KI in Schritt 9 ausschließlich einen Soll-Typ vorschlagen oder zusätzlich die aufgedeckte Feedback-Lücke als lesbaren Text erklären? Für ein pflegbares Beziehungsfeld gibt es in der neuen WG-15 kein Ziel. Soll WG-20 bei fehlenden Bewertungen oder Null-Spend den Vorschlag auslassen oder auf die vorhandenen bewerteten Anteile normieren? Sollen die 23 vorhandenen Hebeldimensionen bestätigt oder vom Fachteam neu zugeordnet werden? Bleibt die Fragen-Funktion für WG aus der älteren WG-23 im Umfang?
9. **F9 · Rollen je Warengruppe.** Darf die Funktion im Team die Kostensicht lesen oder gilt „nie“ aus der Zielmatrix? Sind Admins generell leseberechtigt oder nur als Freigebende? Soll ein Commodity Manager Widersprüche der betroffenen Warengruppen lösen dürfen wie in rechte.md oder ist das auf Leads und SRO aus WG-20 beschränkt? Für SRO verlangt WG-15 im Entwurf nur die eigene Zeile. Dieser Umfang muss auch bei Zusammenführung und KI-Protokoll erhalten bleiben.
10. **F10 · Anmeldung.** Sollen Entra und Google über den bestehenden Zitadel-Issuer föderieren oder zusätzliche direkte Identitäten erhalten? Bei direkter Anbindung braucht es die Zuordnung bestehender Konten und eine Datenebene für user_identity. Wie wird die verlangte Startrolle „ohne Lieferantenzugriff“ gegenüber dem heutigen organisationsweiten Leserecht durchgesetzt? Ein bloßer Treffer auf die Mailadresse genügt laut IN-02 nicht.
11. **F11 · Private Kommunikation.** Sollen zwei Nutzer dieselbe Mail jeweils privat ablegen können oder eine gemeinsame Nachricht mit separaten privaten Ablagen besitzen? Welche Sichtbarkeit gilt bei Weiterleitung ohne Auswahl? Wer darf Rohtranskripte lesen: Organisator automatisch, wie IN-05 vorsieht, oder erst nach SRO-Freigabe gemäß Rechteergänzung? Dürfen Fundstellen nach Ablauf der Rohtextfrist wörtliche Zitate behalten? Soll der Mail-Fallback auch bei bewusst deaktivierter Mail greifen, und welchem Anlass ist die Terminerinnerung zugeordnet? Die Voreinstellungen und die kind-Liste in IN-06 unterscheiden sich hier.
12. **F12 · Import.** Soll KI-15 einen gemeinsamen Stapel für PLT-07 und IN-07 einführen oder erhält die API einen eigenen, an den bisherigen Domänendienst angebundenen Stapel? Welche Schlüssel gelten für Teilaufrufe mit gleicher Lieferung, Wiederholung nach 24 Stunden und Ersatz einer Periode durch einen zweiten API-Schlüssel? Sonst lässt sich „dieselbe Lieferung“ nicht eindeutig prüfen. Ersetzung und Fehleransicht müssen auch innerhalb derselben Organisation auf die berechtigte Lieferung begrenzt bleiben.

## Abgleich von Daten, Seiten und Prüfkriterien

| Objekt oder Seite | Bestand und Auswirkung |
|---|---|
| meeting, Teilnehmende | Migration 0040 definiert meeting, meeting_participant, Agenda und Beschlüsse als shared, meeting_note pro Organisation als privat. Kalenderkennungen, Adressen, Links, Opt-ins und Rohtext dürfen bei einem geteilten Termin nicht über API oder Agenda mitgeliefert werden. IN-03 ergänzt meeting_attendee mit abweichenden Feldern. |
| hint, import_batch | 0073 und FS-01 liefern Regeln, Fingerabdruck und Status, aber keine score- oder severity-Spalte. PLT-07 und supplier-import.service.ts verarbeiten Importvorschau und Übernahme. Ein import_batch fehlt bis 0087. Beide vermeintlichen Erweiterungen benötigen die ausstehenden KI-Specs. |
| org_setting, user_setting | 0063 hat JSON-Wert und Eindeutigkeit je Organisation und Schlüssel, 0080 begrenzt die zulässigen Schlüssel. KI-01, NAV-10 und IN-05 müssen dieselbe Registrierung erweitern. Bei NAV-10 sind mehrere Jahresziele je Organisation im Schlüssel oder Wert abzubilden. user_setting existiert im Migrationsstand nicht. |
| note, activity_feed | Geplante Beziehungsnotiz je Autor, zusätzlich zu meeting_note und material_group_note. Der Feed ist eine neue Sicht, keine weitere Kopie von Notizen oder Verlauf. Aufrufende Person, Leserecht auf das Quellobjekt und Autorprüfung bei private sind je Zweig nötig, auch bei Zählung, Suche und KI-Zusammenfassung. |
| KI-Speicher | ai_draft hat Text, kind, object_type/object_id und draft/accepted/discarded. ai_source kann ohne draft_id direkt am Ziel hängen. KI-03 verlangt strukturierten Inhalt, Quellen je claim_key und vier andere Zustände. 0074–0077, 0085 und die Bestandsfunktionen sind gemeinsam zu migrieren. model_call, agent*, insight_summary, relationship_target, value_* und author_question sind neue Aufträge. |
| Stammdaten und Import | organization, relationship, relationship_side und relationship_spend bilden Stammdaten, private Nummern und Spend ab. supplier als Objektart der Import-API ist kein Nachweis einer gleichnamigen Tabelle. Annualisierte Beträge und mehrwährungsfähiger Bestand unterscheiden sich von monatlichen API-Lieferungen. |
| WG-Tabellennamen | 0080–0087 verwenden material_group, relationship_material_group und material_group_* für Produktgruppen, Team, Strategie, Fragen, Notizen, Ziele, Analysen, Kandidaten, Marktkräfte, Profil und Hebel. category_* in WG und KI sind überwiegend Fachnamen dafür. Neue Objekte ab WG-12 sind geplante Tabellen. segment_decision und segmentation_round aus SEG wurden bereits in 0082 erweitert. WG-Gruppeninitiativen dürfen nicht mit JBP-Initiativen zusammenfallen. |
| Berechtigte Anzeige | Die Basismatrix in rechte.md ist generiert. Aktionen plus Ressourcenprüfung in can(), Käufermerkmal und Mandanten-Session bestimmen den Zugriff. Die KI-/IN-Zielmatrizen sind als Planung aufgenommen. „Käufer mit Zugriff“ allein berechtigt weder zu allen Daten einer Organisation noch zum Schreiben als Team-Leser. In keiner neuen Spec ist die Freigabe privater Käuferdaten an Lieferanten vorgesehen. Reale Risiken bei Umsetzung nach Wortlaut sind geteilte Termine, indirekte Zugriffe über Quellen/Protokolle/Empfänger und ein wiederverwendeter Gesamtbericht mit fremden sichtbaren Zahlen. |
| Routen | /uebersicht leitet gegenwärtig auf /start. /portfolio/matrix samt wg-Filter, Bewertungsrunden, /wirkung, /fragen, /lieferanten, /kunden und die WG-Strategierouten existieren. /mein-tag, Posteingang, Agentenseiten, neue Ergebnisse-Unterpfade, persönliche Verbindungen und Integrationsverwaltung sind Soll-Routen. Alte Unterpfade und Queryparameter mit übernehmen, /start für Lieferanten differenzieren. Für Termine ist QBR-01 die Spec. Die Referenzen Termin-Briefing und Termin-Ergebnisse allein spezifizieren KI-17 nicht. |

**Testlücken.** LS-01 nennt 300 ms bei 2.000 Lieferanten. Es fehlen Testgerät bzw. DB-Profil, Messstrecke, Stichprobe und Warm-/Kaltzustand. AW-01 definiert den Fortschritt bei identischer Basis und Ziel nicht; die Übersicht muss auch ohne Ziel oder Kandidaten prüfbar sein. NAV-10 nennt einmal genau drei Karten und andernorts weniger; Gleichstände bei Chance, Risiko und Zielanteil brauchen stabile Beispieldaten. IN-03 lässt „ähnlichen“ Betreff und unsicheren Termintyp ohne Schwelle. IN-01 sollte für eine unzulässige Signatur zwischen technischer Verbindungsauflösung und Lesen von Fachdaten unterscheiden, damit der Ablehnungsnachweis testbar ist. Bei KI-08 lässt sich die inhaltliche Stützung mit datierten positiven und negativen Quellbeispielen prüfen. Bei WG-20 fehlen für den gewichteten Mittelwert Regeln für Null-Spend und fehlende Bewertungen. Für IN-05 braucht der Fristtest eine kontrollierte Uhr und getrennte Prüfungen für Text, Zitate und Entwürfe. Bei WG-12/14 sind Review und Warnung mit den späteren Freigabe- bzw. Map-Daten abzunehmen.

**Designvorlagen.** Die HTML-Dateien sind Canvas-Exporte. Für die Planfassung gilt [designsprache.neu.md](../design/designsprache.neu.md) mit dreizehn Regeln; CLAUDE.md verweist heute noch auf die bisherige Fassung mit zehn Regeln. Beispielsweise laden Header und Lieferantenliste Figtree und Outfit von Google; die Designsprache verlangt lokale Schriften. Der Profilknopf im Navigations-Header ist 40 × 40 px (Zeile 28), die Bedienfläche soll mindestens 44 px erreichen. Der KI-Header führt „Portfolio“ und „Agenten“ als Hauptpunkte, die KI-SupplierBar zeigt „Strategisch“ als Segment. Für den Bau gelten die vier Punkte aus NAV-10, die SEG-Namen und die jeweils fachlich zugehörige Vorlage. Die Referenz-Lücken unten betreffen die eigenständige Canvas-Vorschau.

## Direkt berichtigte Kleinigkeiten

- KI-03, KI-07 und KI-13 verweisen für Aufgaben und Entwürfe auf Mein Tag (NAV-10). KI-04 und KI-09 verwenden den Agentenpfad unter Einstellungen › KI. KI-11 verwendet die Ergebnisse- und Übersichtsadressen aus AW-01. Alte Adressen bleiben Weiterleitungsfälle für NAV-10.
- IN-03 nennt QBR-01 für das bestehende Terminmodul. WG-18.neu verweist für Konsolidierung auf SEG-06. WG-20.neu nennt in der Zeilenbeschreibung Soll-Typ und Beziehungsqualität aus dem Segment.
- WG-06.neu ergänzt den Test für die bereits in „Daten“ geforderte Aktualisierung der Ist-Werte binnen drei Monaten.
- KI-08 korrigiert die vertauschte Aussage im Quellenkriterium. In WG-04.neu beschreibt der Negativtest einen Käufer ohne die bereits ausdrücklich erlaubten Sonderrechte.
- Glossar um die Begriffe aus NAV, AW, KI, IN und WG ergänzt und die ältere Definition der Supplier Map angepasst. Die ursprüngliche Übersetzungstabelle bleibt für die gebaute UI gültig. Der Generator von rechte.md führt die KI- und IN-Regeln als geplante Matrizen, damit die nächste Erzeugung sie erhält. Die WG-Matrix aus der Ergänzung war bereits enthalten.

## Kollisionsverzeichnis

Je Bundle stehen hier die neben dem Bestand abgelegten Arbeitsfassungen. Gleichnamige, bytegleiche Lieferungen können auf dieselbe Arbeitskopie verweisen. Die Originale bleiben je Bundle im Eingang.

- **reziproq-designsprache-2** — [designsprache.neu.md](../design/designsprache.neu.md), [Aufgaben.neu.dc.html](../design/referenz/Aufgaben.neu.dc.html), [Flow.neu.dc.html](../design/referenz/Flow.neu.dc.html), [Fragen.neu.dc.html](../design/referenz/Fragen.neu.dc.html), [GroupBar.neu.dc.html](../design/referenz/GroupBar.neu.dc.html), [Header.neu.dc.html](../design/referenz/Header.neu.dc.html), [Import.neu.dc.html](../design/referenz/Import.neu.dc.html), [L-Ueberblick.neu.dc.html](../design/referenz/L-Ueberblick.neu.dc.html), [L-Warengruppen.neu.dc.html](../design/referenz/L-Warengruppen.neu.dc.html), [Lieferanten.neu.dc.html](../design/referenz/Lieferanten.neu.dc.html), [Main.neu.dc.html](../design/referenz/Main.neu.dc.html), [P-Freigabe.neu.dc.html](../design/referenz/P-Freigabe.neu.dc.html), [P-Initiativen.neu.dc.html](../design/referenz/P-Initiativen.neu.dc.html), [P-Scorecard.neu.dc.html](../design/referenz/P-Scorecard.neu.dc.html), [P-Themen.neu.dc.html](../design/referenz/P-Themen.neu.dc.html), [P-Vorbereitung.neu.dc.html](../design/referenz/P-Vorbereitung.neu.dc.html), [P-Zusagen.neu.dc.html](../design/referenz/P-Zusagen.neu.dc.html), [SupplierBar.neu.dc.html](../design/referenz/SupplierBar.neu.dc.html), [WG-Aufsetzen.neu.dc.html](../design/referenz/WG-Aufsetzen.neu.dc.html), [WG-Bewertung.neu.dc.html](../design/referenz/WG-Bewertung.neu.dc.html), [WG-Freigabe.neu.dc.html](../design/referenz/WG-Freigabe.neu.dc.html), [WG-Intern.neu.dc.html](../design/referenz/WG-Intern.neu.dc.html), [WG-Lieferanten.neu.dc.html](../design/referenz/WG-Lieferanten.neu.dc.html), [WG-Markt.neu.dc.html](../design/referenz/WG-Markt.neu.dc.html), [WG-Scorecard.neu.dc.html](../design/referenz/WG-Scorecard.neu.dc.html), [WG-SupplierMap.neu.dc.html](../design/referenz/WG-SupplierMap.neu.dc.html), [WG-Uebersicht.neu.dc.html](../design/referenz/WG-Uebersicht.neu.dc.html), [WG-Vergaben.neu.dc.html](../design/referenz/WG-Vergaben.neu.dc.html), [WG-Ziele.neu.dc.html](../design/referenz/WG-Ziele.neu.dc.html).

- **reziproq-spec-navigation 2** — [D-Diagramme.neu.dc.html](../design/referenz/D-Diagramme.neu.dc.html), [GroupBar.neu.dc.html](../design/referenz/GroupBar.neu.dc.html), [Header.neu.dc.html](../design/referenz/Header.neu.dc.html), [Main.neu.dc.html](../design/referenz/Main.neu.dc.html), [SupplierBar.neu.dc.html](../design/referenz/SupplierBar.neu.dc.html), [Uebersicht.neu.dc.html](../design/referenz/Uebersicht.neu.dc.html).

- **reziproq-spec-lieferantenliste** — [Header.neu2.dc.html](../design/referenz/Header.neu2.dc.html), [Lieferanten.neu.dc.html](../design/referenz/Lieferanten.neu.dc.html).

- **reziproq-spec-auswertungen** — [D-Diagramme.neu.dc.html](../design/referenz/D-Diagramme.neu.dc.html), [L-Ueberblick.neu2.dc.html](../design/referenz/L-Ueberblick.neu2.dc.html), [P-Scorecard.neu2.dc.html](../design/referenz/P-Scorecard.neu2.dc.html), [Uebersicht.neu.dc.html](../design/referenz/Uebersicht.neu.dc.html).

- **reziproq-specs-ki-2** — [WG-23.neu.md](../specs/WG-23.neu.md), [Fragen.neu2.dc.html](../design/referenz/Fragen.neu2.dc.html), [Header.neu2.dc.html](../design/referenz/Header.neu2.dc.html), [KI-Wert-Uebersicht.neu.dc.html](../design/referenz/KI-Wert-Uebersicht.neu.dc.html), [KI-Wert.neu.dc.html](../design/referenz/KI-Wert.neu.dc.html), [SupplierBar.neu2.dc.html](../design/referenz/SupplierBar.neu2.dc.html).

- **reziproq-specs-anbindungen** — [L-Notizen.neu.dc.html](../design/referenz/L-Notizen.neu.dc.html).

- **reziproq-specs-warengruppen-2** — [WG-01.neu.md](../specs/WG-01.neu.md), [WG-04.neu.md](../specs/WG-04.neu.md), [WG-06.neu.md](../specs/WG-06.neu.md), [WG-07.neu.md](../specs/WG-07.neu.md), [WG-09.neu.md](../specs/WG-09.neu.md), [WG-10.neu.md](../specs/WG-10.neu.md), [WG-12.neu.md](../specs/WG-12.neu.md), [WG-14.neu.md](../specs/WG-14.neu.md), [WG-15.neu.md](../specs/WG-15.neu.md), [WG-16.neu.md](../specs/WG-16.neu.md), [WG-18.neu.md](../specs/WG-18.neu.md), [WG-20.neu.md](../specs/WG-20.neu.md), [WG-23.neu2.md](../specs/WG-23.neu2.md), [WG-startdaten.neu.md](../specs/WG-startdaten.neu.md).

## Fehlende lokale Dateien in den Referenzseiten

Alle in den Specs namentlich verlangten Seitenvorlagen sind im Referenzordner vorhanden. Die Vorlagen selbst nennen weitere Canvas-Seiten. Die folgende Liste erfasst wörtliche lokale Dateinamen aus den gelieferten HTML-Dateien, jeweils mit einer Fundstelle. Dynamische Canvas-Navigation wurde nicht ausgeführt.

| Fehlendes Ziel | Beispiel einer verweisenden Vorlage |
|---|---|
| `B-Spielregeln.dc.html` | `SupplierBar.dc.html` |
| `B-Team.dc.html` | `L-Warengruppen.dc.html` |
| `E-Formular.dc.html` | `L-Warengruppen.dc.html` |
| `E-Uebersicht.dc.html` | `E-Anbindungen.dc.html` |
| `Hinweise.dc.html` | `Main.dc.html` |
| `Import-Pruefen.dc.html` | `E-Anbindungen.dc.html` |
| `K-Arbeitsbereich.dc.html` | `Header.dc.html` |
| `K-Start.dc.html` | `Header.dc.html` |
| `L-Lieferantenplan.dc.html` | `Aufgaben.dc.html` |
| `L-Profil.dc.html` | `SupplierBar.dc.html` |
| `L-Segmentierung.dc.html` | `L-Warengruppen.dc.html` |
| `P-Initiative.dc.html` | `P-Initiativen.dc.html` |
| `P-Kennzahl.dc.html` | `Aufgaben.dc.html` |
| `PF-Bewerten.dc.html` | `Aufgaben.dc.html` |
| `PF-Portfolio.dc.html` | `Header.dc.html` |
| `PF-Runde.dc.html` | `WG-Lieferanten.dc.html` |
| `U-Massnahmen.dc.html` | `Aufgaben.dc.html` |
| `U-Termin.dc.html` | `P-Vorbereitung.dc.html` |
| `U-Termine.dc.html` | `KI-Baukasten.dc.html` |
| `W-Pruefung.dc.html` | `Aufgaben.dc.html` |
| `W-Uebersicht.dc.html` | `Header.dc.html` |
| `support.js` | `Aktivitaeten.dc.html` |

## Lokale Kontrolle

Die 31 Statuszeilen, Ablageziele und relativen Berichtslinks wurden geprüft. Die abgelegten HTML-Arbeitskopien sind bytegleich mit ihren jeweiligen Eingangsdateien. Bei zwei Vorlagen (Main und Lieferanten) meldet Git Leerraum auf je einer Leerzeile aus dem Originalexport. Der lokale Lauf von `pnpm check` endete erfolgreich, mit 2.769 bestandenen Tests, einem übersprungenen Test und 134 bestandenen Browser-Tests. Diese Tests prüfen den gebauten Stand; die neuen Abnahmekriterien sind Planungsgrundlage.

## Entscheidungen des Gründers (23.11.2026)

- **F3:** Ein Agent `insight_summary` für alle Seiten, neu bei geänderten Fakten, höchstens einmal je
  Stunde; je Person gespeichert. Die Übersicht hat drei Sätze, alle anderen Seiten höchstens zwei
  Karten.
- **F6 (nur KI-07):** Vorerst nur QBR sieben Tage vorher; ein neuer Lauf ersetzt nur den offenen
  Entwurf desselben Termins. Weitere Termintypen kommen mit IN-03. Die übrigen Fragen aus F6
  (Terminmodell, Add-in) bleiben offen.
- **F7:** Jeweils die vorsichtigste Stufe; `user_assumption` und eigene Daten älter als zwölf Monate
  ergeben `low`.

## Nachtrag: KI-Paket vom 23.11.2026 (`eingang/reziproq-specs-ki-3`)

Eingang: neue Specs KI-15 bis KI-23, überarbeitete KI-01, KI-03, KI-04, KI-07, KI-08, KI-09, KI-11,
KI-13, WG-23, dazu Vorlagen, Glossar, Rechte und Umsetzungsplan. Eingeordnet in `docs/specs/`,
`docs/design/referenz/`, `glossar.md`, `rechte.md` und die Warteschlange. In schon gebauten Specs
bleiben Abschnitt „Umsetzung“ und erfüllte Kriterien erhalten.

| Spec | Befund | Bezug |
|---|---|---|
| KI-01, KI-03, KI-08, KI-09, KI-13 | Kleinigkeit: Modellklasse `embed` (ab K2), Mein Tag statt Start, Adressen `/agenten/…`. Gebautes bleibt gültig. | F13 |
| KI-04 | Konflikt: Hauptnavigation mit Punkt **Agenten** unter `/agenten`; NAV-10 hat vier Hauptpunkte und Agenten nur über Einstellungen › KI (gebaut, getestet). | F13 |
| KI-11 | Konflikt in Adressen: Wertpotenziale unter `/lieferanten/<id>/plan/wertpotenziale` (erster Reiter im Plan) und `/wirkung/wertpotenziale`; NAV-10 leitet `/wirkung` auf `/uebersicht`, gebaut ist Ergebnisse › Wertpotenziale und `/uebersicht/wertpotenziale`. Neu und ohne Konflikt: Seite im Aufbau von AW-01 plus Detailseite je Potenzial (`KI-Wert-Detail`). | F13 |
| KI-07 | Neue Fassung „Termin-Briefing“: alle wichtigen Termintypen mit Vorlauf, acht Teile, Agenda mit Zeiten und Teilnehmern, Fragen an das Team, Prüfsumme der Eingaben, Outlook-Einladung. Ersetzt die heute gebaute QBR-Vorbereitung und die Entscheidung F6 für KI-07. Termintypen Verhandlung, Werksbesuch/Audit, Eskalation fehlen im Modul Termine und werden ergänzt. Agent `qbr_prep` wird zu `meeting_brief`. | – |
| KI-15 | Konflikt im Datenmodell: setzt eine Tabelle `supplier` und `category_id` voraus. Im Bestand sind Lieferanten Organisationen mit Beziehung, Warengruppen heißen `material_group`. PLT-07 hat schon einen Import mit Vorschau und Übernahme; KI-15 soll ihn laut Ergänzung erweitern. | F4, F12, F15 |
| KI-16 | OK: erweitert `hint` aus FS-01 statt einer zweiten Tabelle; `public_event` nur mit Testanbieter der Websuche. | – |
| KI-17 | OK: `meeting_capture` neu; braucht die Ziele aus KI-07 (neue Fassung). Dateien als DOCX oder PDF brauchen einen Speicher (wie KI-18). | – |
| KI-18 | Infrastruktur: `pgvector`, Objektspeicher in der EU (lokal Ordner oder MinIO), OCR mit `tesseract`. In AWS nur über `infra/` mit OpenTofu. | – |
| KI-19 bis KI-22 | Bauen auf KI-15 und KI-18 bzw. auf der Warengruppenstrategie; nach den Warengruppen (K2). | F15 |
| KI-23 | Läufe des Lieferanten mit `billed_org_id` des Käufers; die Tabellen sind `org_private` der Lieferantenorganisation. Vor dem Bau Ebenen und Budgetzuordnung prüfen (K3). | – |
| WG-23 | Ersetzt `WG-23.md`: Entwürfe aus KI-03, Einstellungen aus KI-01. `WG-23.neu.md` und `WG-23.neu2.md` aus dem Warengruppen-Paket bleiben zum Abgleich liegen. | F5, F8 |
| Vorlagen | `Header`, `SupplierBar`, `Fragen`, `Main` aus dem KI-Paket (21./22.11.) zeigen die alte Navigation (Start, Portfolio, Wirkung, Agenten). Für die gebaute Oberfläche gelten die neueren `.neu`-Fassungen aus dem Navigationspaket. Neu: `Hinweise`, `Import-Pruefen`. | F13 |

Offene Entscheidungen aus diesem Paket:

13. **F13 · Navigation der KI-Specs.** Die KI-Specs und ihre Vorlagen sind vor NAV-10 entstanden
    (Hauptpunkt Agenten, `/wirkung/…`, Wertpotenziale im Plan). Gilt NAV-10 (vier Hauptpunkte,
    Agenten unter Einstellungen › KI, Wertpotenziale unter Ergebnisse) und die KI-Specs werden auf
    diese Adressen abgebildet? Oder bekommt Agenten einen fünften Hauptpunkt und Wertpotenziale
    wandern in den Plan? Vorschlag: NAV-10 gilt, die Inhalte der KI-Specs bleiben unverändert.
14. **F14 · Datenmodell Import (KI-15).** `supplier` und `category_id` gibt es nicht. Vorschlag:
    Lieferant = Organisation mit Beziehung des Käufers, Warengruppe = `material_group`; Alias und
    Regeln je Käufer; der bestehende Import aus PLT-07 wird erweitert (Vorschau, Prüfung, Übernahme
    als Stapel). Hängt mit F4 (Kurzname, Fremdwährung) und F12 (gemeinsamer Stapel) zusammen.

Entschieden am 23.11.2026:

- **F13:** NAV-10 gilt. Die Inhalte der KI-Specs werden auf die Adressen von NAV-10 abgebildet:
  Agenten unter Einstellungen › KI, Wertpotenziale unter Ergebnisse und `/uebersicht/wertpotenziale`.
- **F14:** KI-15 wird auf den Bestand abgebildet: Lieferant = Organisation mit Beziehung des Käufers,
  Warengruppe = `material_group`, Alias und Regeln je Käufer; der Import aus PLT-07 wird erweitert.

## Offene Frage aus der Umsetzung (23.11.2026)

- **F15 · KI-17 gegen JBP-06.** KI-17 lässt übernommene Zusagen aus einem Termin „im Gemeinsamen
  Plan“ entstehen. JBP-06 sperrt den Inhalt eines freigegebenen Plans; neue Zusagen werden mit 409
  abgelehnt. Vorläufig: Ist der Plan freigegeben, entsteht eine Maßnahme mit Verweis auf die Zusage;
  ein neues Datum für eine Zusage im freigegebenen Plan wird abgelehnt. Soll stattdessen eine Zusage
  aus einem Termin auch nach der Freigabe in den Plan dürfen, ohne neue Version?

- **F12 · Import (vorläufig umgesetzt mit IN-07).** Ein gemeinsamer Stapel für Datei und API
  (`import_batch` mit `source`). `idempotency_key` gilt je Schlüssel 24 Stunden; Teilaufrufe mit
  `batch_id` nur vom selben Schlüssel. Ein Monat Spend aus einer neueren Lieferung ersetzt den Monat
  älterer Lieferungen derselben Herkunft, auch wenn sie mit einem anderen Schlüssel desselben Kunden
  kamen. Lesen dürfen Schlüssel nur ihre eigenen Lieferungen. Soll das so bleiben?
