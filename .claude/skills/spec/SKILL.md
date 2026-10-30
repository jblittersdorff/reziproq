---
name: spec
description: Setzt eine Spec aus docs/specs um, vom Branch bis zum Pull Request
argument-hint: [Spec-ID, leer = nächste offene]
disable-model-invocation: true
---

Setze die Spec $ARGUMENTS um. Ist keine ID angegeben, nimm die erste Spec in docs/specs/README.md mit Status "offen", deren Abhängigkeiten alle "fertig" sind.

1. Vorbereitung: Prüfe zuerst mit git status, ob der Arbeitsstand sauber ist. Ist er es nicht, hör auf und sag es mir, bevor du den Branch wechselst oder etwas holst. Wechsle dann auf main und führe git pull aus. Setze Specs mit Status "PR offen", deren Pull Request gemergt ist (gh pr list --state merged --limit 1000), auf "fertig".
2. Lesen: docs/specs/README.md, die Spec, CLAUDE.md und bei Oberfläche den Skill ui-design. Ist eine Abhängigkeit nicht "fertig", hör auf und sag mir, welche fehlt.
3. Branch: Lege spec/<ID>-<kurzname> an und setze den Status in der README auf "in Arbeit".
4. Fragen und Plan: Stell mir zuerst alle offenen Fragen zur Spec. Zeig mir dann den Plan und warte auf mein OK, bevor du Code änderst.
5. Umsetzen: Schreib für jedes Kriterium unter "Fertig, wenn" mindestens einen Test und nenne das Kriterium im Testnamen. Trag neue Tabellen ins Register der Datenebenen ein (PLT-04). Erzeuge Migrationen mit db:generate. Erweitere pnpm db:seed, wenn die Spec es verlangt.
6. Prüfen: Führe pnpm typecheck, pnpm lint und pnpm test aus, bei Oberfläche auch Playwright. Behebe Fehler, bis alles grün ist. Schwäch nie einen Test ab und überspring keinen, nur damit es grün wird.
7. Bericht: Zeig mir eine Tabelle Kriterium – Test – Ergebnis. Liste auf, was ich von Hand erledigen muss (z. B. Schritte in Zitadel, Befehle, was ich im Browser prüfen soll). Nenn jede Abweichung von der Spec. Die Spec passt du nur nach meinem OK an, und zwar im selben Pull Request.
8. Pull Request: Setze den Status auf "PR offen", committe, pushe und erstelle einen Pull Request mit dem Titel "<ID> <Funktion>" nach unserer Vorlage.
9. Mergen: Warte auf die CI (gh pr checks --watch). Ist sie grün, merge den Pull Request (gh pr merge --merge) und hol main mit git pull. Ist sie rot, behebe die Ursache, pushe erneut und warte wieder; merge nie mit roter CI und schwäch keinen Test ab. Den Status "fertig" setzt der nächste Lauf in Schritt 1.
10. Danach aufhören. Beginn nicht die nächste Spec.

Lies niemals .env.
