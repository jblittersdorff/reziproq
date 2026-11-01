import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type ForbiddenCode,
  lastFullYear,
  type Money,
  type Supplier,
  type SuppliersResponse,
} from '@reziproq/shared';
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

  /**
   * Lieferanten der eigenen Organisation mit Anzahl und Gesamtspend des letzten vollen Jahres
   * (PLT-03). Beendete Beziehungen kommen mit, zählen aber nicht mit.
   */
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

    const spendYear = lastFullYear();
    const suppliers = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) => listSuppliers(tx, spendYear),
    );
    const current = suppliers.filter((supplier) => supplier.status !== 'ended');
    return {
      suppliers,
      count: current.length,
      spendYear,
      totalSpend: totalByCurrency(current),
    };
  }

  /**
   * Suche für das Prompt-Fenster (PLT-12). Läuft über list(), also mit denselben Rechten und
   * derselben Mandanten-Session wie GET /api/suppliers, und liefert höchstens 20 Treffer.
   */
  async search(auth: AuthContext, filter: SupplierFilter): Promise<Supplier[]> {
    const suppliers = (await this.list(auth)).suppliers.filter((s) => s.status !== 'ended');
    const contains = (value: string, part: string | undefined) =>
      !part || value.toLocaleLowerCase('de').includes(part.trim().toLocaleLowerCase('de'));
    // Spend-Filter gelten in Euro. Beträge in anderen Währungen werden nicht umgerechnet und
    // fallen bei gesetztem Filter heraus, statt falsch verglichen zu werden.
    const spendFilter = filter.minSpendEuro !== undefined || filter.maxSpendEuro !== undefined;
    const euro = (supplier: Supplier) => (supplier.spend?.amountCents ?? 0) / 100;

    const hits = suppliers.filter(
      (supplier) =>
        contains(supplier.name, filter.name) &&
        contains(supplier.externalRef ?? '', filter.nummer) &&
        (!filter.land || supplier.country === filter.land.toUpperCase()) &&
        (!spendFilter || supplier.spend?.currency === 'EUR') &&
        (filter.minSpendEuro === undefined || euro(supplier) >= filter.minSpendEuro) &&
        (filter.maxSpendEuro === undefined || euro(supplier) <= filter.maxSpendEuro),
    );
    const sorted = [...hits].sort((a, b) => {
      if (filter.sortierung === 'name') return a.name.localeCompare(b.name, 'de');
      const diff = (a.spend?.amountCents ?? 0) - (b.spend?.amountCents ?? 0);
      return filter.sortierung === 'spend_aufsteigend' ? diff : -diff;
    });
    return sorted.slice(0, Math.min(filter.anzahl ?? 20, 20));
  }
}

export interface SupplierFilter {
  name?: string | undefined;
  nummer?: string | undefined;
  land?: string | undefined;
  minSpendEuro?: number | undefined;
  maxSpendEuro?: number | undefined;
  sortierung?: 'spend_absteigend' | 'spend_aufsteigend' | 'name' | undefined;
  anzahl?: number | undefined;
}

/**
 * Liest die Lieferanten in einer Mandanten-Session. Gefiltert wird nur über Row-Level Security:
 * relationship_side und relationship_spend liefern nur die eigenen Zeilen (PLT-04). Ohne gesetzte
 * Organisation liefert die Abfrage nichts. Auch PLT-12 nutzt diese Funktion.
 */
export async function listSuppliers(tx: TenantTransaction, spendYear: number): Promise<Supplier[]> {
  const { organization, relationship, relationshipSide, relationshipSpend } = schema;
  const rows = await tx
    .select({
      relationshipId: relationship.id,
      name: sql<string>`coalesce(${relationshipSide.displayName}, ${organization.name})`,
      country: organization.country,
      externalRef: relationshipSide.externalRef,
      status: relationship.status,
      amountCents: relationshipSpend.amountCents,
      currency: relationshipSpend.currency,
    })
    .from(relationship)
    .innerJoin(organization, eq(organization.id, relationship.supplierOrgId))
    .leftJoin(
      relationshipSide,
      and(
        eq(relationshipSide.relationshipId, relationship.id),
        eq(relationshipSide.orgId, relationship.buyerOrgId),
      ),
    )
    .leftJoin(
      relationshipSpend,
      and(
        eq(relationshipSpend.relationshipId, relationship.id),
        eq(relationshipSpend.year, spendYear),
      ),
    )
    .orderBy(sql`${relationshipSpend.amountCents} desc nulls last`, organization.name);

  return rows.map(({ amountCents, currency, ...supplier }) => ({
    ...supplier,
    spend: amountCents !== null && currency !== null ? { amountCents, currency } : null,
  }));
}

function totalByCurrency(suppliers: Supplier[]): Money[] {
  const totals = new Map<string, number>();
  for (const { spend } of suppliers) {
    if (!spend) continue;
    totals.set(spend.currency, (totals.get(spend.currency) ?? 0) + spend.amountCents);
  }
  return [...totals].map(([currency, amountCents]) => ({ amountCents, currency }));
}
