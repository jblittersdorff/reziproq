import type { Supplier, SuppliersResponse } from '@reziproq/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../auth/auth.guard.js';
import type { OrganizationService } from '../organizations/organization.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { runTool } from './tools.js';

// Werkzeug lieferanten_suchen mit Beträgen in verschiedenen Währungen, ohne Datenbank:
// Die Liste aus list() wird im Test vorgegeben.

const supplier = (name: string, amountCents: number, currency: string): Supplier => ({
  relationshipId: `rel-${name}`,
  name,
  country: 'DE',
  category: 'Elektronik',
  annualSpend: { amountCents, currency },
  spendYear: 2025,
});

const list: SuppliersResponse = {
  suppliers: [
    supplier('Euro-Lieferant', 600_000_00, 'EUR'),
    supplier('Dollar-Lieferant', 900_000_00, 'USD'),
  ],
  count: 2,
  spendYear: 2025,
  totalSpend: [],
};

function service() {
  const suppliers = new SuppliersService(null as never, null as unknown as OrganizationService);
  vi.spyOn(suppliers, 'list').mockResolvedValue(list);
  return suppliers;
}

const auth: AuthContext = { userId: 'u', roles: ['nutzer'], accessToken: 't', organization: null };

describe('SuppliersService.search', () => {
  it('liefert ohne Spend-Filter Beträge jeder Währung', async () => {
    const hits = await service().search(auth, {});
    expect(hits.map((s) => s.name)).toEqual(['Dollar-Lieferant', 'Euro-Lieferant']);
  });

  it('vergleicht Spend-Filter nur mit Euro-Beträgen und lässt andere Währungen weg', async () => {
    const hits = await service().search(auth, { minSpendEuro: 500_000 });
    expect(hits.map((s) => s.name)).toEqual(['Euro-Lieferant']);
  });
});

describe('Werkzeug lieferanten_suchen', () => {
  it('nennt der KI jeden Betrag in seiner eigenen Währung', async () => {
    const events: unknown[] = [];
    const result = await runTool(
      { type: 'tool_use', id: 'tool-1', name: 'lieferanten_suchen', input: {} },
      auth,
      service(),
      (event) => events.push(event),
    );
    const content = JSON.parse(String(result.content)) as {
      treffer: { name: string; jahresspend: string }[];
    };
    const spend = Object.fromEntries(content.treffer.map((t) => [t.name, t.jahresspend]));
    expect(spend['Euro-Lieferant']).toBe('600.000 €');
    expect(spend['Dollar-Lieferant']).toBe('900.000 $');
  });
});
