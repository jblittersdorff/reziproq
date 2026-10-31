# PUL-01 Fragebogen

Release 0.2 · baut auf PLT-09

## Ziel

Beide Seiten beantworten denselben kurzen, verständlichen Fragebogen auf Deutsch oder Englisch. Jede Frage hat ein Ist und ein Soll, damit sichtbar wird, wie die Beziehung ist und wie sie sein sollte.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Fragebogen der eigenen Organisation anpassen: Fragen ein- und ausblenden, umformulieren, eigene ergänzen. |
| Alle Teilnehmenden | Fragen beantworten (PUL-02). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `survey_template` | `id`, `org_id` (leer = Standard von Reziproq), `kind` (`pulse`, `annual`), `version`, `status` | `org_private`, Standard `global` |
| `survey_question` | `template_id`, `dimension`, `text_de`, `text_en`, `position`, `active` | wie Vorlage |

- **Skala:** 1 bis 5 für Ist („Wie ist es heute?“) und Soll („Wie sollte es sein?“), dazu „Kann ich nicht beurteilen“. Am Ende ein optionales Freitextfeld.
- **Standard-Dimensionen:** Vertrauen, Zusammenarbeit, Integration, Transparenz, strategische Ausrichtung.
- **Puls**, drei Fragen:
  1. Wie zufrieden bin ich insgesamt mit der Zusammenarbeit?
  2. Wie sehr vertrauen wir einander?
  3. Wie gut sind wir auf gemeinsame Ziele ausgerichtet?
- **Jahres-Feedback:** fünf Fragen je Dimension, also 25. Vorschlag (Deutsch, Englisch übersetzt Claude Code und die Gründer prüfen):
  - **Vertrauen:**
    - Zusagen werden eingehalten.
    - Informationen werden nicht gegen uns verwendet.
    - Bei Problemen suchen wir gemeinsam eine Lösung.
    - Wir können offen über Schwierigkeiten sprechen.
    - Die andere Seite handelt auch in schwierigen Phasen fair.
  - **Zusammenarbeit:**
    - Ansprechpartner sind klar und erreichbar.
    - Entscheidungen fallen schnell genug.
    - Abläufe zwischen uns sind einfach.
    - Konflikte werden sachlich gelöst.
    - Die Zusammenarbeit funktioniert über alle Funktionen hinweg.
  - **Integration:**
    - Wir werden früh in Planungen einbezogen.
    - Entwicklungsteams arbeiten eng zusammen.
    - Planungs- und Bedarfsdaten werden regelmäßig abgestimmt.
    - Systeme und Daten sind sinnvoll verbunden.
    - Verbesserungen werden gemeinsam umgesetzt.
  - **Transparenz:**
    - Wir kennen die mittelfristigen Pläne der anderen Seite.
    - Bedarfs- und Kapazitätsinformationen sind verlässlich.
    - Kostentreiber werden offen besprochen.
    - Risiken werden früh angesprochen.
    - Rückmeldungen auf Vorschläge kommen zuverlässig.
  - **Strategische Ausrichtung:**
    - Wir verfolgen gemeinsame langfristige Ziele.
    - Die Geschäftsleitungen tauschen sich regelmäßig aus.
    - Innovationen werden gemeinsam vorangetrieben.
    - Beide Seiten investieren in die Beziehung.
    - Die Beziehung schafft messbaren Wert für beide.

## Ablauf

1. **Einstellungen › Fragebogen** (`/einstellungen/fragebogen`) hat zwei Kacheln: Puls, Jahres-Feedback.
2. Je Fragebogen: Liste der Fragen nach Dimension, mit Schalter aktiv und inaktiv. Bearbeiten auf eigener Seite mit Deutsch und Englisch.
3. Änderungen erzeugen eine neue Version. Laufende Wellen behalten ihre Version.
4. **Vorschau** zeigt den Fragebogen genau so, wie Teilnehmende ihn sehen.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jede neue Käuferorganisation hat beide Standard-Fragebögen auf Deutsch und Englisch.
- [ ] Jede Frage hat Text in beiden Sprachen, sonst lässt sie sich nicht aktivieren.
- [ ] Eine Änderung erzeugt eine neue Version, laufende Wellen bleiben unverändert.
- [ ] Der Puls ist in unter fünf Minuten ausgefüllt (von Hand geprüft, im Pull Request notiert).

## Nicht Teil dieser Funktion

- Wellen und Antworten (PUL-02)
- Auswertung (PUL-03)
- Fragebogen des Lieferanten für eigene Zwecke
