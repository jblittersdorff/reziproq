/**
 * Zitadel Action (Actions v1) · Flow „Complement Token“ · Trigger „Pre Userinfo creation“.
 * Name der Action in Zitadel: reziproqIdpClaim (muss dem Funktionsnamen entsprechen).
 *
 * Gibt die gemerkten Angaben als Claim `urn:reziproq:idp` aus. Ohne Metadaten (Anmeldung mit
 * Passkey oder Passwort) fehlt der Claim; dann greift in Reziproq die Passwort-Regel.
 */
function reziproqIdpClaim(ctx, api) {
  var result = ctx.v1.user.getMetadata();
  var entries = (result && result.metadata) || [];
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].key !== 'reziproq_idp') continue;
    var raw = entries[i].value;
    try {
      api.v1.claims.setClaim('urn:reziproq:idp', JSON.parse(raw));
    } catch (e) {
      // Wert kam nicht als JSON an; beim Durchstich prüfen (docs/betrieb/durchstich.md, Schritt 6)
    }
    return;
  }
}
