import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type Database, desc, eq, schema, type TenantTransaction, withTenant } from '@reziproq/db';
import type { ForbiddenCode, Money, Supplier, SuppliersResponse } from '@reziproq/shared';
import { InjectDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { OrganizationService } from '../organizations/organization.service.js';

const forbidden = (code: ForbiddenCode, message: string) =>
  new ForbiddenException({ statusCode: 403, code, message });

@Injectable()
export class SuppliersService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
  ) {}

  /** Lieferanten der eigenen Organisation mit Anzahl und Gesamtspend (PLT-02). */
  async list(auth: AuthContext): Promise<SuppliersResponse> {
    if (!can(auth, 'lieferanten.sehen')) {
      throw forbidden('keine_berechtigung', 'Dir fehlt eine Rolle, um Lieferanten zu sehen.');
    }
    const organization = await this.organizations.forUser(auth.userId);
    if (!organization) {
      throw forbidden('keine_organisation', 'Du bist noch keiner Organisation zugeordnet.');
    }
    if (organization.typ !== 'kaeufer') {
      throw forbidden('keine_berechtigung', 'Die Lieferantenliste gibt es nur für Käufer.');
    }

    const suppliers = await withTenant(this.db, organization.id, (tx) => listSuppliers(tx));
    return { suppliers, count: suppliers.length, totalSpend: totalByCurrency(suppliers) };
  }
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
      country: organization.land,
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
