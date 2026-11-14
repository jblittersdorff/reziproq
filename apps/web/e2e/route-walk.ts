import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Rundgang über alle Routen mit nachgebauter API, für PLT-09 und UMB-05.

export const id = '0190a0a0-0000-7000-8000-000000000001';

/** Alle Routen der App aus dem erzeugten Routenbaum, mit Beispielwerten für Parameter. */
export function allRoutes(): string[] {
  const tree = readFileSync(new URL('../src/routeTree.gen.ts', import.meta.url), 'utf8');
  const block = tree.slice(
    tree.indexOf('export interface FileRoutesByFullPath'),
    tree.indexOf('}', tree.indexOf('export interface FileRoutesByFullPath')),
  );
  return [...block.matchAll(/^\s+'([^']+)':/gm)].map(([, path]) =>
    (path as string)
      .replace('$id', id)
      .replace('$jahr', '2025')
      .replace('$nutzer', 'nina')
      .replace('$kind', 'pulse')
      .replace(/\/\$$/, '/gibt-es-nicht')
      // Weitere Parameter wie $key oder $topicId bekommen die Beispiel-ID.
      .replace(/\$[A-Za-z]+/g, id)
      .replace(/(.)\/$/, '$1'),
  );
}

export async function signIn(page: Page, stored: { locale: 'de' | 'en' }) {
  const zitadel = await fakeZitadel(page);
  // Alles, was ein Test nicht nachspielt, antwortet sofort mit 404: kein Proxy-Fehler, keine
  // Wiederholungen. Später registrierte Routen haben Vorrang.
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 404, json: { statusCode: 404, code: 'nicht_gefunden' } }),
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        isControlling: true,
        isOperator: true,
        locale: stored.locale,
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: true,
        },
      },
    }),
  );
  await page.route('**/api/me/sprache', (route) => {
    stored.locale = route.request().postDataJSON().locale;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'rollen.aendern',
          'einstellungen.verwalten',
          'lieferanten.sehen',
          'lieferanten.bearbeiten',
          'team.festlegen',
          'verlauf.sehen',
          'prompt.nutzen',
          'kunden.wechseln',
        ],
      },
    }),
  );
  const supplier = {
    relationshipId: id,
    name: 'Rheintal Elektronik GmbH (Demo)',
    country: 'DE',
    externalRef: 'L-10001',
    status: 'active',
    spend: { amountCents: 4_820_000_00, currency: 'EUR' },
  };
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers: [supplier],
        count: 1,
        spendYear: 2025,
        totalSpend: [{ amountCents: 4_820_000_00, currency: 'EUR' }],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        ...supplier,
        organizationName: supplier.name,
        vatId: 'DE123456789',
        duns: null,
        notes: null,
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [{ year: 2025, amount: { amountCents: 4_820_000_00, currency: 'EUR' } }],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [
          {
            tile: 'strategy',
            kind: 'spend',
            year: 2025,
            amount: { amountCents: 4_820_000_00, currency: 'EUR' },
          },
          { tile: 'relationship', kind: 'team_size', count: 2 },
        ],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/team`, (route) =>
    route.fulfill({
      json: {
        members: [
          { userId: 'lena', name: 'Lena Berger', teamRole: 'sro', function: 'purchasing' },
          { userId: 'nina', name: 'Nina Roth', teamRole: 'viewer', function: null },
        ],
        candidates: [
          { userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' },
          { userId: 'nina', name: 'Nina Roth', defaultFunction: null },
        ],
      },
    }),
  );
  const members = [
    {
      id: 'lena',
      name: 'Lena Berger',
      email: 'lena@example.com',
      orgRole: 'admin',
      isControlling: true,
      defaultFunction: 'purchasing',
    },
    {
      id: 'nina',
      name: 'Nina Roth',
      email: 'nina@example.com',
      orgRole: 'viewer',
      isControlling: false,
      defaultFunction: null,
    },
  ];
  await page.route('**/api/organisation', (route) =>
    route.fulfill({ json: { name: 'Test-OEM (Demo)', country: 'DE', members } }),
  );
  await page.route('**/api/organisation/mitglieder/*', (route) =>
    route.fulfill({ json: members[1] }),
  );
  // Lieferantenseite (LIF-02): ein Kunde mit Arbeitsbereich, damit /kunden/<id>/… Titel zeigt.
  await page.route('**/api/kunden', (route) =>
    route.fulfill({
      json: { customers: [{ relationshipId: id, name: 'Test-OEM (Demo)', nextMeeting: null }] },
    }),
  );
  await page.route(`**/api/kunden/${id}`, (route) =>
    route.fulfill({
      json: { relationshipId: id, name: 'Test-OEM (Demo)', relationshipType: null, nextMeeting: null },
    }),
  );
  await page.route('**/api/betreiber/kunden', (route) =>
    route.fulfill({
      json: { customers: [{ id: 'org-2', name: 'Zweit-OEM (Demo)', country: 'AT' }] },
    }),
  );
  await page.route('**/api/audit**', (route) =>
    route.fulfill({
      json: {
        entries: [
          {
            id: 'e1',
            occurredAt: '2026-11-12T13:05:00Z',
            actorName: 'Lena Berger',
            organization: 'Test-OEM (Demo)',
            action: 'updated',
            changes: { status: { from: 'draft', to: 'active' } },
          },
        ],
      },
    }),
  );
  // Business Units und Warengruppen (PLT-06); der Eintrag mit der ID aus allRoutes() ist bearbeitbar.
  const entry = { id, name: 'Elektronik', code: 'EL', active: true, supplierCount: 0 };
  await page.route('**/api/business-units', (route) =>
    route.fulfill({ json: { businessUnits: [entry, { ...entry, id: 'bu-2', active: false }] } }),
  );
  await page.route('**/api/material-groups', (route) =>
    route.fulfill({ json: { materialGroups: [{ ...entry, parentId: null, childCount: 0 }] } }),
  );
  await page.route(`**/api/suppliers/${id}/zuordnung`, (route) =>
    route.fulfill({
      json: {
        businessUnits: [{ id, name: 'Elektronik', code: 'EL', active: false }],
        materialGroups: [{ id, name: 'Elektronik', code: 'EL', active: true, isPrimary: true }],
        canEdit: true,
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  return zitadel;
}
