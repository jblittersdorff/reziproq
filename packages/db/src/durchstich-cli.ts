import { createDatabase } from './client.js';

// Durchstich (docs/betrieb/durchstich.md): pnpm durchstich:pruefen
// Prüft Umgebung, Zitadel, Actions, Microsoft und die Verknüpfung der Käufer. Zeigt nie Geheimnisse.
// Liegt hier wie org:link, weil es Verknüpfungen über alle Organisationen liest (Eigentümer-Verbindung).

const env = process.env;
const issuer = (env.ZITADEL_ISSUER ?? '').replace(/\/+$/, '');
const serviceToken = env.ZITADEL_SERVICE_TOKEN ?? '';
const apiPublicUrl = (env.API_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

type Result = { ok: boolean; text: string };
const results: Result[] = [];
const check = (ok: boolean, text: string) => results.push({ ok, text });

async function reachable(url: string, init: RequestInit = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    return response.status;
  } catch {
    return 0;
  }
}

function zitadel(path: string, orgId: string | null, body?: unknown) {
  return fetch(`${issuer}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
      ...(orgId ? { 'x-zitadel-orgid': orgId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
}

async function actionsOf(orgId: string): Promise<string[]> {
  const response = await zitadel('/management/v1/actions/_search', orgId, {});
  if (!response?.ok) return [];
  const data = (await response.json()) as { result?: { name?: string }[] };
  return (data.result ?? []).map((entry) => entry.name ?? '');
}

async function main() {
  check(env.IDENTITY_PROVIDER === 'zitadel', 'IDENTITY_PROVIDER=zitadel');
  check(Boolean(serviceToken), 'ZITADEL_SERVICE_TOKEN gesetzt');
  check(
    Boolean(env.SSO_ENTRA_CLIENT_ID && env.SSO_ENTRA_CLIENT_SECRET),
    'SSO_ENTRA_CLIENT_ID und _SECRET gesetzt',
  );
  check(
    Boolean(env.CONNECTION_SECRET_KEY),
    'CONNECTION_SECRET_KEY gesetzt (sonst gelten Zugänge nur bis zum Neustart)',
  );
  check(env.MICROSOFT_PROVIDER === 'live', 'MICROSOFT_PROVIDER=live (nur für Teil 2 nötig)');
  check(
    Boolean(issuer) && (await reachable(`${issuer}/.well-known/openid-configuration`)) === 200,
    `Zitadel erreichbar (${issuer || 'ZITADEL_ISSUER fehlt'})`,
  );
  if (serviceToken) {
    check(
      (await zitadel('/management/v1/orgs/me', null))?.status === 200,
      'Token des Dienstkontos gilt',
    );
  }
  check(
    (await reachable(
      'https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration',
    )) === 200,
    'Microsoft-Anmeldung erreichbar',
  );

  const { pool } = createDatabase();
  try {
    const linked = await pool.query<{ name: string; zitadel_org_id: string; buyer: boolean }>(`
      select o.name, o.zitadel_org_id,
        exists (select 1 from organization_feature f
          where f.organization_id = o.id and f.feature = 'buyer') as buyer
      from organization o where o.zitadel_org_id is not null order by o.name`);
    const buyers = linked.rows.filter((row) => row.buyer);
    check(
      buyers.length > 0,
      `Käufer mit Zitadel-Organisation verknüpft (pnpm org:link): ${buyers.map((row) => row.name).join(', ') || 'keiner'}`,
    );
    for (const row of serviceToken ? buyers : []) {
      check(
        (await zitadel('/management/v1/orgs/me', row.zitadel_org_id))?.status === 200,
        `Dienstkonto darf in „${row.name}“ verwalten`,
      );
      const actions = await actionsOf(row.zitadel_org_id);
      check(
        actions.includes('reziproqIdpMerken') && actions.includes('reziproqIdpClaim'),
        `Actions reziproqIdpMerken und reziproqIdpClaim in „${row.name}“ (Flows von Hand prüfen)`,
      );
    }
    const sso = await pool.query<{ provider: string; status: string; name: string }>(`
      select s.provider, s.status, o.name from org_sso s join organization o on o.id = s.org_id`);
    check(
      sso.rows.some((row) => row.status === 'active'),
      `Firmenanmeldung aktiv: ${sso.rows.map((row) => `${row.name} ${row.provider} ${row.status}`).join(', ') || 'noch nicht eingerichtet (Schritt 6)'}`,
    );
  } finally {
    await pool.end();
  }

  console.log('\nDurchstich: Stand der Einrichtung\n');
  for (const result of results) console.log(`${result.ok ? '  ok   ' : '  FEHLT'}  ${result.text}`);
  console.log(
    `\nRückleitung für die App-Registrierung (Teil 2): ${apiPublicUrl}/api/anbindungen/oauth/microsoft/callback`,
  );
  console.log(
    'Callback für Zitadel: in der Zitadel-Console beim Anbieter „Microsoft (Firmenkonto)“.\n',
  );
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

if (process.env.NODE_ENV === 'production') {
  console.error('Nur für die lokale Entwicklung.');
  process.exitCode = 1;
} else {
  await main();
}
