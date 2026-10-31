import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { ForbiddenCode, Money, Supplier, SuppliersResponse } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { OrganizationService } from '../organizations/organization.service.js';

const forbidden = (code: ForbiddenCode, message: string) =>
  new ForbiddenException({ statusCode: 403, code, message });

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
  ) {}

  /** Lieferanten der eigenen Organisation mit Anzahl und Gesamtspend (PLT-02). */
  async list(auth: AuthContext): Promise<SuppliersResponse> {
    if (!can(auth, 'lieferanten.sehen')) {
      throw forbidden('keine_berechtigung', 'Dir fehlt eine Rolle, um Lieferanten zu sehen.');
    }
    const organization = this.organizations.current(auth);
    if (!organization) {
      throw forbidden('keine_organisation', 'Du bist noch keiner Organisation zugeordnet.');
    }
    // Käuferfunktionen hängen am Feature buyer der Organisation (PLT-02).
    if (!organization.buyer) {
      throw forbidden('keine_berechtigung', 'Die Lieferantenliste gibt es nur für Käufer.');
    }

    const suppliers = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) => listSuppliers(tx),
    );
    const spendYear = suppliers.length > 0 ? Math.max(...suppliers.map((s) => s.spendYear)) : null;
    return {
      suppliers,
      count: suppliers.length,
      spendYear,
      totalSpend: totalByCurrency(suppliers.filter((s) => s.spendYear === spendYear)),
    };
  }

  /**
   * Suche für das Prompt-Fenster (PLT-12). Läuft über list(), also mit denselben Rechten und
   * derselben Mandanten-Session wie GET /api/suppliers, und liefert höchstens 20 Treffer.
   */
  async search(auth: AuthContext, filter: SupplierFilter): Promise<Supplier[]> {
    const { suppliers } = await this.list(auth);
    const contains = (value: string, part: string | undefined) =>
      !part || value.toLocaleLowerCase('de').includes(part.trim().toLocaleLowerCase('de'));
    // Spend-Filter gelten in Euro. Beträge in anderen Währungen werden nicht umgerechnet und
    // fallen bei gesetztem Filter heraus, statt falsch verglichen zu werden.
    const spendFilter = filter.minSpendEuro !== undefined || filter.maxSpendEuro !== undefined;
    const euro = (supplier: Supplier) => supplier.annualSpend.amountCents / 100;

    const hits = suppliers.filter(
      (supplier) =>
        contains(supplier.name, filter.name) &&
        contains(supplier.category, filter.warengruppe) &&
        (!filter.land || supplier.country === filter.land.toUpperCase()) &&
        (!spendFilter || supplier.annualSpend.currency === 'EUR') &&
        (filter.minSpendEuro === undefined || euro(supplier) >= filter.minSpendEuro) &&
        (filter.maxSpendEuro === undefined || euro(supplier) <= filter.maxSpendEuro),
    );
    const sorted = [...hits].sort((a, b) => {
      if (filter.sortierung === 'name') return a.name.localeCompare(b.name, 'de');
      const diff = a.annualSpend.amountCents - b.annualSpend.amountCents;
      return filter.sortierung === 'spend_aufsteigend' ? diff : -diff;
    });
    return sorted.slice(0, Math.min(filter.anzahl ?? 20, 20));
  }
}

export interface SupplierFilter {
  name?: string | undefined;
  warengruppe?: string | undefined;
  land?: string | undefined;
  minSpendEuro?: number | undefined;
  maxSpendEuro?: number | undefined;
  sortierung?: 'spend_absteigend' | 'spend_aufsteigend' | 'name' | undefined;
  anzahl?: number | undefined;
}

/**
 * Liest die Lieferanten in einer Mandanten-Session. Gefiltert wird nur über Row-Level Security:
 * Ohne gesetzte Organisation liefert die Abfrage nichts. Auch PLT-12 nutzt diese Funktion.
 */
export async function listSuppliers(tx: TenantTransaction): Promise<Supplier[]> {
  const { beziehung, beziehungKaeufer, organization } = schema;
  const rows = await tx
    .select({
      relationshipId: beziehung.id,
      name: organization.name,
      country: organization.country,
      category: beziehungKaeufer.warengruppe,
      amountCents: beziehungKaeufer.jahresspendCent,
      currency: beziehungKaeufer.waehrung,
      spendYear: beziehungKaeufer.spendJahr,
    })
    .from(beziehung)
    .innerJoin(beziehungKaeufer, eq(beziehungKaeufer.beziehungId, beziehung.id))
    .innerJoin(organization, eq(organization.id, beziehung.lieferantOrgId))
    .orderBy(desc(beziehungKaeufer.jahresspendCent), organization.name);

  return rows.map(({ amountCents, currency, ...supplier }) => ({
    ...supplier,
    annualSpend: { amountCents, currency },
  }));
}

function totalByCurrency(suppliers: Supplier[]): Money[] {
  const totals = new Map<string, number>();
  for (const { annualSpend } of suppliers) {
    totals.set(
      annualSpend.currency,
      (totals.get(annualSpend.currency) ?? 0) + annualSpend.amountCents,
    );
  }
  return [...totals].map(([currency, amountCents]) => ({ amountCents, currency }));
}
