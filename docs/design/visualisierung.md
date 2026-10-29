# Visualisierungen

- Jede Grafik beantwortet eine Frage; die Antwort steht als Satz im Titel.
- Grau für Kontext, die Akzentfarbe für das Wichtige, Ampelfarben nur für Status.
- Direkt beschriften statt Legende. Keine 3D-, Torten- oder Tachodiagramme.
- Segmentierung: 3x3-Matrix mit festen Feldern, Punkte = Lieferanten, Größe = Einkaufsvolumen,
  Pfeil von Ist zu Soll.
- Wahrnehmungslücke: je Dimension ein Hantel-Diagramm mit Käufer- und Lieferantensicht;
  der Abstand ist die Lücke.
- Abweichungen zwischen Business Units: Heatmap mit einer Farbskala von hell nach dunkel, Zahl im Feld.
- GuV-Wirkung: P&L-Brücke als Wasserfall von der Baseline über die Hebel zur realisierten Wirkung;
  Wertpipeline als gestapelte Balken nach Reifegrad; EBIT-Wirkung nie mit Kostenvermeidung addieren.
- Verläufe über Zeit: Linien, höchstens drei.
- Jede Grafik hat einen leeren Zustand, der erklärt, was fehlt.
- Recharts für Standarddiagramme, ECharts für Matrix, Heatmap und Wasserfall, React Flow für die
  Relationship Map. Farben nur aus den Design-Tokens.
