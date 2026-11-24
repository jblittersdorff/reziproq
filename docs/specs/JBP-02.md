# JBP-02 Themen beider Seiten

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: GP-01. Themen, Initiativen, Freigabe und Scorecard stehen auf der Seite des Gemeinsamen Plans; die nächste Version entwirft Reziproq aus dem Protokoll; der Verlauf einer Kennzahl öffnet als Blatt (E-K4-4). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.3 · baut auf JBP-01, SPL-06 · deckt ab JBP-02, LIF-04 (Themen des Lieferanten)

## Ziel

Beide Seiten bringen ihre wichtigsten Themen ein und sehen sie nebeneinander. Der SRO führt sie zu gemeinsamen Initiativen zusammen.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO | Interne strategische Themen (SPL-06) als Vorschlag übernehmen, eigene Themen anlegen, Themen zusammenführen. |
| Key Account Manager | Themen des Lieferanten anlegen und ordnen. |
| Beide Seiten | Alle Themen im Plan sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `jbp_topic` | `id`, `jbp_id`, `side`, `title`, `description`, `priority`, `status` (`proposed`, `merged`, `parked`) | `shared` |
| `jbp_topic_origin` | `jbp_topic_id`, `strategic_topic_id` | `buyer_private`. Herkunft aus dem Lieferantenplan, nur für den Käufer. |

- Übernahme heißt Verweis statt Kopie der Begründung: Das Thema im Plan hat nur Titel und eine kurze, teilbare Beschreibung. Begründung und Ziele bleiben im Lieferantenplan.

## Ablauf

1. **Themen** (`/…/plan/themen`) zeigt zwei Spalten, Käufer und Lieferant, jeweils nach Priorität geordnet.
2. Der SRO klickt auf **Aus Lieferantenplan übernehmen** und kommt auf eine Seite mit den internen Themen. Er wählt aus und schreibt je Thema die teilbare Beschreibung.
3. Neu und Bearbeiten auf eigenen Seiten, jede Seite nur für ihre Themen.
4. Zusammenführen zu einer Initiative kommt mit JBP-03.
5. Nicht weiterverfolgte Themen lassen sich mit kurzer Begründung parken.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Übernommene Themen zeigen dem Lieferanten nur Titel und teilbare Beschreibung, nie Begründung oder Ziele.
- [x] Die Herkunft eines Themas sieht nur der Käufer (PLT-04).
- [x] Jede Seite ändert nur ihre eigenen Themen.
- [x] Geparkte Themen bleiben mit Begründung sichtbar.

## Nicht Teil dieser Funktion

- Initiativen selbst und das Zusammenführen von Themen zu einer Initiative (JBP-03)
