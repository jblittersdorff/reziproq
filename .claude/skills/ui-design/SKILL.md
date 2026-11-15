---
name: ui-design
description: "Pflicht bei jeder Arbeit an der Oberfläche von apps/web: neue Seiten, Komponenten,
  Formulare, Tabellen, Diagramme. Hält Designsprache „Zwei Kreise“, Tokens und Bausteine von
  Reziproq ein."
---
# UI-Regeln Reziproq
Vor jeder Änderung docs/design/designsprache.md (verbindlich), docs/design/prinzipien.md und
docs/design/visualisierung.md lesen. Den Abschnitt „Oberfläche: Designsprache ‚Zwei Kreise‘“ in
CLAUDE.md beachten.
- Nur Bausteine aus apps/web/src/components/ui und Werte aus den Design-Tokens
  (apps/web/src/styles/tokens.css). Fehlt ein Baustein, ihn im UI-Paket anlegen und auf /design
  zeigen, nicht in der Seite bauen.
- Eine Hauptaktion je Ansicht (Tinte-Karte „Nächster Schritt“). Jede Seite hat einen leeren, einen
  Lade- und einen Fehlerzustand.
- Texte auf Deutsch und Englisch, kurz.
- Es gibt nur ein helles Thema.
- Nach der Änderung: App starten, mit Playwright Screenshots der geänderten Seite machen
  (1440 und 390 Pixel breit), ansehen, Verstöße gegen Designsprache und Prinzipien beheben,
  dann die Screenshots zeigen.
- Gibt es eine Vorlage in docs/design/referenz/ (.dc.html), das Ergebnis mit ihr vergleichen und
  in der Abschlussmeldung sagen, ob die Seite „nach Vorlage“ oder „nach Regeln“ gebaut ist.
