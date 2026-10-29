---
name: ui-design
description: "Pflicht bei jeder Arbeit an der Oberfläche von apps/web: neue Seiten, Komponenten,
  Formulare, Tabellen, Diagramme. Hält Designprinzipien, Tokens und Styleguide von Reziproq ein."
---
# UI-Regeln Reziproq
Vor jeder Änderung docs/design/prinzipien.md und docs/design/visualisierung.md lesen.
- Nur Bausteine aus apps/web/src/components/ui und Werte aus den Design-Tokens.
- Eine Hauptaktion je Ansicht. Jede Seite hat einen leeren, einen Lade- und einen Fehlerzustand.
- Texte auf Deutsch und Englisch, kurz.
- Nach der Änderung: App starten, mit Playwright Screenshots der geänderten Seite machen
  (hell und dunkel, 1440 und 390 Pixel breit), ansehen, Verstöße gegen die Prinzipien beheben,
  dann die Screenshots zeigen.
- Gibt es Bilder in docs/design/referenzen/, das Ergebnis mit ihnen vergleichen.
