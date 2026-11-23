/**
 * Zitadel Action (Actions v1) · Flow „External Authentication“ · Trigger „Post Authentication“.
 * Name der Action in Zitadel: reziproqIdpMerken (muss dem Funktionsnamen entsprechen).
 *
 * Merkt sich nach der Anmeldung über Microsoft oder Google, wer der Anbieter war: Anbieter,
 * Subject (bei Entra die Objekt-ID `oid`, sonst `sub`), Mandant (`tid`) bzw. Google-`hd`.
 * Reziproq prüft diese Angaben beim ersten Anmelden (IN-02, SsoGate).
 */
function reziproqIdpMerken(ctx, api) {
  var info = ctx.v1.providerInfo || {};
  var claims = info.idToken ? info.idToken : info;
  var tenant = claims.tid || null;
  var hd = claims.hd || null;
  var provider = tenant ? 'entra' : hd || claims.iss === 'https://accounts.google.com' ? 'google' : null;
  if (!provider) return;
  var value = {
    provider: provider,
    subject: String(claims.oid || claims.sub || ''),
  };
  if (tenant) value.tenant = String(tenant);
  if (hd) value.hd = String(hd);
  if (!value.subject) return;
  api.v1.user.appendMetadata('reziproq_idp', JSON.stringify(value));
}
