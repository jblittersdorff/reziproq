import {
  type PromptEvent,
  promptEventSchema,
  type Supplier,
  type SuppliersResponse,
} from '@reziproq/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../auth/auth.guard.js';
import type { OrganizationService } from '../organizations/organization.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { invokePromptTool } from './tools.js';

// Werkzeug lieferanten_suchen mit Beträgen in verschiedenen Währungen, ohne Datenbank:
// Die Liste aus list() wird im Test vorgegeben.

const supplier = (
  name: string,
  amountCents: number,
  currency: string,
  businessUnits: string[],
  materialGroups: string[],
  relationshipId = `rel-${name}`,
): Supplier => ({
  relationshipId,
  name,
  country: 'DE',
  externalRef: null,
  status: 'active',
  spend: { amountCents, currency },
  primaryMaterialGroup: null,
  businessUnits,
  materialGroups,
});

const list: SuppliersResponse = {
  suppliers: [
    supplier(
      'Euro-Lieferant',
      600_000_00,
      'EUR',
      ['IT'],
      ['Elektronik'],
      '00000000-0000-4000-8000-000000000001',
    ),
    supplier('Dollar-Lieferant', 900_000_00, 'USD', ['Logistik'], ['Verpackung']),
  ],
  count: 2,
  spendYear: 2025,
  totalSpend: [],
};

function service(response: SuppliersResponse = list) {
  const suppliers = new SuppliersService(null as never, null as unknown as OrganizationService);
  vi.spyOn(suppliers, 'list').mockResolvedValue(response);
  return suppliers;
}

const auth: AuthContext = {
  userId: 'u',
  accessToken: 't',
  orgRole: 'member',
  isControlling: false,
  isOperator: false,
  tokenRoles: [],
  organization: null,
};

describe('SuppliersService.search', () => {
  it('liefert ohne Spend-Filter Beträge jeder Währung', async () => {
    const hits = await service().search(auth, {});
    expect(hits.map((s) => s.name)).toEqual(['Dollar-Lieferant', 'Euro-Lieferant']);
  });

  it('vergleicht Spend-Filter nur mit Euro-Beträgen und lässt andere Währungen weg', async () => {
    const hits = await service().search(auth, { minSpendEuro: 500_000 });
    expect(hits.map((s) => s.name)).toEqual(['Euro-Lieferant']);
  });

  it('filtert nach Business Unit und Warengruppe und lädt das angefragte Jahr', async () => {
    const suppliers = service();
    const hits = await suppliers.search(auth, {
      businessUnit: 'it',
      materialGroup: 'elektronik',
      year: 2024,
    });
    expect(hits.map((s) => s.name)).toEqual(['Euro-Lieferant']);
    expect(suppliers.list).toHaveBeenCalledWith(auth, 2024);
  });

  it('kann einen Lieferanten beim Öffnen exakt statt nur als Teiltreffer finden', async () => {
    const suppliers = service({
      ...list,
      suppliers: [
        ...list.suppliers,
        supplier('Euro-Lieferant International', 700_000_00, 'EUR', [], []),
      ],
    });
    const hits = await suppliers.search(auth, { name: 'Euro-Lieferant', exactName: true });
    expect(hits.map((hit) => hit.name)).toEqual(['Euro-Lieferant']);
  });
});

describe('Werkzeug lieferanten_suchen', () => {
  it('nennt der KI jeden Betrag in seiner eigenen Währung', async () => {
    const events: PromptEvent[] = [];
    const result = (await invokePromptTool('lieferanten_suchen', {}, auth, service(), (event) =>
      events.push(event),
    )) as {
      treffer: { name: string; spend: string }[];
    };
    const spend = Object.fromEntries(result.treffer.map((t) => [t.name, t.spend]));
    expect(spend['Euro-Lieferant']).toBe('600.000 €');
    expect(spend['Dollar-Lieferant']).toBe('900.000 $');
    expect(events).toHaveLength(1);
  });

  it('gibt für ein angefragtes Jahr auch dieses Jahr in der Werkzeugantwort zurück', async () => {
    const result = (await invokePromptTool(
      'lieferanten_suchen',
      { year: 2024 },
      auth,
      service(),
      () => undefined,
    )) as { treffer: { spendJahr: number }[] };
    expect(result.treffer[0]?.spendJahr).toBe(2024);
  });

  it('bereitet den Spend-Link nur für einen exakt gefundenen Lieferanten vor', async () => {
    const events: PromptEvent[] = [];
    const result = await invokePromptTool(
      'seite_oeffnen',
      { lieferant: 'Euro-Lieferant' },
      auth,
      service(),
      (event) => events.push(event),
    );
    expect(result).toEqual({ geoeffnet: 'Spend von Euro-Lieferant' });
    expect(events).toEqual([
      {
        type: 'navigate',
        destination: {
          type: 'supplierSpend',
          relationshipId: '00000000-0000-4000-8000-000000000001',
        },
      },
    ]);
    expect(promptEventSchema.parse(events[0])).toEqual(events[0]);
  });
});
