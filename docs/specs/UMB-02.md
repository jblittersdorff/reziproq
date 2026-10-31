# UMB-02 Neu anmelden ohne Fenster und Overlay

Release 1.0 (Kernpfad) · baut auf PLT-01, PLT-10 · ersetzt das Popup aus PR #11

## Ziel

Als Nutzer melde ich mich nach einer gescheiterten Erneuerung neu an, ohne dass sich ein Fenster oder Overlay öffnet. Was ich eingegeben habe, bleibt erhalten.

## Wer darf was

| Rolle | Darf |
|---|---|
| Jeder angemeldete Nutzer | Sich neu anmelden; seine Eingaben werden wiederhergestellt. |

## Daten

- Ein Entwurf der offenen Formularfelder liegt kurz in `sessionStorage`, mit Adresse und Zeitpunkt. Nie ein Token.
- Er wird nach der Wiederherstellung gelöscht, spätestens nach 30 Minuten.

## Ablauf

1. Scheitert die Erneuerung, steht oben im Seitenfluss die Rückmeldezeile „Bitte melde dich neu an“ mit Knopf, nicht fest positioniert.
2. Der Knopf speichert den Entwurf, leitet zu Zitadel weiter und kehrt zur selben Adresse zurück.
3. Dort werden die Felder aus dem Entwurf gefüllt, und der Entwurf wird gelöscht.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Es öffnet sich kein Popup, und kein Element ist fest positioniert (Test über `window.open` und berechnete Positionen).
- [ ] Nach der Neuanmeldung steht der eingegebene Text wieder im Feld (Playwright mit nachgebautem Zitadel).
- [ ] `sessionStorage` enthält zu keinem Zeitpunkt ein Token.
- [ ] Ein Entwurf älter als 30 Minuten wird verworfen.

## Nicht Teil dieser Funktion

- Entwürfe über Geräte hinweg
- Automatisches Speichern ganzer Formulare (macht jede Spec selbst, z. B. SEG-04)
