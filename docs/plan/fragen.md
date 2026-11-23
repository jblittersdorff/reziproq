# Offene Fragen zur UX-Umsetzung

Stand 23.11.2026 (Phase 0). Wo Vorlage und Spec sich widersprechen, gilt die Spec. Jede Frage
nennt eine Empfehlung; bis zur Antwort baut die jeweilige Phase nach der Empfehlung, wenn sie
nichts Unumkehrbares bewirkt.

## Vorgehen und Regeln

**F-UX-00 · Reihenfolge gegenüber der Warteschlange.**
- Offen in `docs/umsetzungsplan.md`: Schritt 31b (WG-20 Übergaben und Einschätzung), 32 (WG-23),
  33 (KI-13), 34–39 (KI-18 bis KI-23); dazu Durchstich D und C1–C6.
- Läuft die UX-Umsetzung (Phasen 1–10) vor diesen Schritten, dazwischen oder danach?
- Phase 9 braucht KI-13 (Strategie-Entwurf), Phase 7 braucht KI-18 (Dateien).
- Empfehlung: Phasen 1–6 jetzt; 31b, 32 und 33 vor Phase 9; Phase 7 ohne Dateien, bis KI-18 da ist.

**F-UX-00a · Push.**
- `CLAUDE.md` erlaubt `git push` des Arbeitsbranchs als Sicherung, die Übergabe sagt „kein git
  push“.
- Der Commit `be11239` (Schritt 31a) ist deshalb nur lokal.
- Gilt „kein Push“ ab jetzt für alles oder nur für die UX-Phasen?
- Empfehlung: Push des Arbeitsbranchs als Sicherung beibehalten, wie in `CLAUDE.md`.

## Daten und Fachlogik

**F-UX-01 · `org_module` oder `organization_feature`.**
- `CLAUDE.md` sagt „Add-ons werden je Kunde über eine Freischalt-Tabelle aktiviert“; dafür gibt
  es `organization_feature` (heute nur `buyer`).
- UX-20 verlangt eine neue Tabelle `org_module` mit `enabled` und `updated_at`.
- Neue Tabelle oder Erweiterung der bestehenden?
- Was gilt für `value_finder` und `category_strategy`: Standard an oder aus?
- Empfehlung: neue Tabelle `org_module` wie in UX-20, ohne Zeile gilt der Standard
  (`claims`, `risk`, `contract` aus; `value_finder`, `category_strategy` an).
- Wer schaltet um: nur der Betreiber oder auch der Admin des Kunden?

**F-UX-02 · Beziehungsnetz ohne Datenmodell.**
- `B-Netz`, `B-Person` und der Überblick („wichtigste Kontakte mit Stärke der Verbindung und
  Lücken zu Entscheidern“) brauchen Kontakte der anderen Seite mit Rolle, Einfluss und Stärke
  der Verbindung.
- Im Code gibt es Team (PLB-04) und Kontaktpunkte (PLB-03), keine Stärke der Verbindung.
- Gibt es eine Spec, oder soll ich eine aus der Vorlage ableiten und dir vorlegen?
- Empfehlung: Spec-Entwurf „Beziehungsnetz“ vor Phase 4; Stärke aus Kontaktpunkten und Terminen
  berechnen, nicht von Hand pflegen.

**F-UX-03 · JBP-Termin ohne Spec für Beiträge, Dateien und Präsentation.**
- `J-Anfordern`, `J-Beitraege`, `J-Upload`, `J-Deck`, `J-Teilen`, `J-Moderation`, `K-Beitrag`
  und `K-JBP` beschreiben Beiträge anfordern und sammeln, Dateien zuordnen, eine Präsentation
  erzeugen, teilen und einen Präsentationsmodus.
- Außer UX-20 und NAV-10 nennt keine Spec diese Schritte. Beiträge gibt es heute nur im
  Lieferantenplan (SPL-03).
- Dateien brauchen den Objektspeicher (KI-18, Schritt 34; AWS C1).
- Empfehlung:
  - Spec-Entwurf „JBP-Termin“ vor Phase 7, mit Datenebenen (Beitrag des Lieferanten geteilt,
    interne Beiträge privat).
  - Phase 7 zunächst ohne Upload, mit Hinweis „kommt mit Dokumenten“.

**F-UX-04 · `next_action` und `timeline_item` als SQL-Sicht oder im Code.**
- NAV-10 nennt beide „Sicht, keine Tabelle“. Heute bestimmt der Code die fälligen Dinge je Modul
  (`dueItems`) und die nächsten Schritte je Seite.
- Eine SQL-Sicht über alle Quellen ist schwer mit der Zeilensicherheit und den Rechten je
  Warengruppe (Lead, Team, SRO) zu verbinden. Ein Beispiel: Freigebende sehen den Entwurf nur
  über ihre Unterschrift.
- Empfehlung: Je eine Funktion im Code mit gemeinsamem Schema, `scope` und `score` (eine Quelle,
  ein Test), keine Datenbank-Sicht. Das Verhalten entspricht der Spec.

**F-UX-05 · Zeitbedarf in „Als Nächstes“.**
- `Main` und `A-MeinTag` zeigen „2 Min.“ in der Kurzzeile.
- Woher kommt der Wert: fest je Art der Aufgabe, gepflegt oder geschätzt?
- Empfehlung: fest je Art im Code (z. B. Kennzahl erfassen 2 Min., Bewertung 10 Min.); ohne Wert
  keine Angabe.

**F-UX-06 · „Brauchen dich“ und „Laufen gut“ in der Lieferantenliste.**
- Nach welcher Regel kommt ein Lieferant in welche Gruppe, und woher kommt der Grund in einer
  Zeile?
- Empfehlung: „Brauchen dich“, wenn ein `next_action` mit Fälligkeit bis heute, ein offener
  Hinweis, ein offener Widerspruch oder eine überfällige Zusage besteht; der Grund ist dessen
  Titel. Sonst „Laufen gut“.

**F-UX-07 · Adressen der zehn Schritte.**
- NAV-10 nennt Schritt 10 unter `/warengruppen/<id>/strategie/freigabe`. Heute sind die Schritte
  nummeriert (`/strategie/1` bis `/10`).
- Sollen alle Schritte sprechende Adressen bekommen (`aufsetzen`, `ziele`, …, `freigabe`), mit
  Weiterleitung der Nummern?
- Empfehlung: ja, alle zehn, Nummern leiten weiter.

**F-UX-08 · Konsolidieren ab Spanne 2.**
- UX-20: Konsolidieren ist Pflicht, wenn die Spanne bei einem Kriterium 2 oder mehr beträgt.
- SEG-06 heute: Konsolidieren ist immer möglich, Entscheidung je Gruppe mit Begründung.
- Die Vorlage `PF-Konsolidieren` zeigt eine Skala 1 bis 5 und vier Kriterien (Versorgungsrisiko,
  Wertbeitrag, Qualität, Innovation).
- SEG-04 und der Code bewerten je Kriterium mit Reglern von 0 bis 100. Die Kriterien kommen aus
  dem Segmentmodell (zehn Kriterien als Startwerte, je Kunde einstellbar).
- Was heißt „Spanne 2“ auf 0 bis 100?
- Empfehlung: Skala und Kriterien wie SEG-04 lassen (die Spec gilt); die Schwelle als
  einstellbarer Wert im Segmentmodell, Start 40 Punkte (entspricht 2 Stufen auf 1 bis 5). Bitte
  bestätigen.

## Vorlage gegen Spec (gilt die Spec)

**F-UX-09 · Sätze zu Risiken und Verträgen.**
- UX-20 verlangt: mit Modulen aus „kein Satz zu Claims, Risiken oder Verträgen“.
- Die Vorlagen nutzen die Wörter auch fachlich:
  - Risiken in der SWOT (`WG-Bewertung`, `WG-Markt`);
  - Verträge in der Lieferantenbasis (`WG-Lieferanten`, `WG-Scorecard`);
  - Vertragslaufzeit bei Wertpotenzialen (`KI-Wert-Detail`);
  - Risikoinformationen in den Spielregeln (`B-Spielregeln`).
- Empfehlung: Die Regel gilt nur für die Module (Routen `/claims`, `/risiken`, `/vertrag`,
  Karten, Zeilen, Termine, Krisen). Fachbegriffe in Strategie und Spielregeln bleiben. Der Test
  sucht nach Routen und Modulbegriffen, nicht nach dem Wort.

**F-UX-10 · Modulbezogene Teile der Vorlagen.**
- `Uebersicht`/`A-Uebersicht`: Risikobild, Krise, Claims-Karte.
- `L-Ueberblick`: Zeile „Claims und Risiken“.
- `Main`: ein Claim in den Fristen.
- `KI-Agenten`, `KI-Lauf`: Risiko-Agent.
- `Termin-Briefing`: „Risiken“.
- Diese Teile entfallen mit den Modulen aus. Ob „Risiken“ im Briefing fachlich (Themen aus
  Hinweisen) oder das Modul meint, ist offen.
- Empfehlung: Im Briefing bleiben Hinweise mit Risiko-Charakter aus FS-01, ohne Bezug zum Modul.

**F-UX-11 · Weitere `Header`-Vorlagen.**
- LIESMICH sagt „`Header.dc.html` löschen“. In `docs/design/referenz/` liegen noch
  `Header.neu.dc.html` und `Header.neu2.dc.html`.
- Empfehlung: ebenfalls löschen, da NAV-10 1.1 keine Kopfzeile mehr kennt.

**F-UX-12 · `.neu.dc.html`-Vorlagen.**
- Neben den ersetzten Vorlagen liegen ältere Fassungen `*.neu.dc.html` (z. B. `WG-SupplierMap.neu`,
  `L-Warengruppen.neu`) aus früheren Lieferungen.
- Die neue Lieferung ersetzt jeweils die Datei ohne `.neu`.
- Empfehlung: Die `.neu`-Fassungen nach `docs/eingang/alt/` verschieben, damit nur eine Vorlage
  je Seite gilt.

**F-UX-13 · Bereits gebaute Seiten nach älterer Vorlage.**
- Supplier Map, Vergabeplan, Freigabe und Warengruppen des Lieferanten sind in den letzten
  Schritten nach den `.neu`-Vorlagen gebaut.
- Die neue Lieferung ändert diese Vorlagen, u. a. KI-Entwurf mit 1 px Mint-Rand statt
  gestricheltem Petrol und Karten ohne Schatten.
- Empfehlung: Angleichen in Phase 1 (Bausteine) und Phase 8/9 (Seiten), nicht vorher.

**F-UX-14 · Umbruch der Seitenleiste.**
- NAV-10 1.1 und die Designsprache: 760/761 px.
- Heute: 1024 px (`--breakpoint-sidebar`).
- Zwischen 761 und 1100 px hat die Seitenleiste neben zwei Spalten wenig Platz; die
  Designsprache sagt „unter 1100 px eine Spalte“.
- Empfehlung: Spec umsetzen (761 px), zwei Spalten erst ab 1100 px.

## Entschieden am 23.11.2026 (Gründer: „Empfehlungen übernehmen“)

Alle Empfehlungen oben gelten. Ergänzt:
- **F-UX-00a:** Der Arbeitsbranch wird wie bisher nach jedem grünen Commit gepusht (Sicherung,
  `CLAUDE.md`).
- **F-UX-01:** Module schaltet vorerst nur der Betrieb (direkt in `org_module`); die App liest
  nur. Eine Oberfläche für Admins kommt, wenn ein Modul gebaut wird.
- **F-UX-02, F-UX-03:** Spec-Entwürfe „Beziehungsnetz“ und „JBP-Termin“ kommen vor Phase 4 bzw. 7
  zur Freigabe.
