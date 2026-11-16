import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { sql, type TenantTransaction } from '@reziproq/db';
import {
  maxHitsPerKind,
  type SearchHit,
  type SearchQuery,
  type SearchResults,
  searchResultsSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CustomersService } from '../customers/customers.service.js';
import { prefixQuery } from './search.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

interface Row extends Record<string, unknown> {
  id: string;
  relationship_id: string;
  title: string;
  detail: string | null;
}

/**
 * QS-05: Volltextsuche (Deutsch und Englisch) auf Lieferanten, Initiativen und Maßnahmen. Jede
 * Abfrage läuft in der Mandanten-Session; RLS entscheidet, was sichtbar ist. Beim Lieferanten nur
 * im aktuellen Kunden.
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  async search(auth: AuthContext, input: SearchQuery): Promise<SearchResults> {
    const organization = auth.organization;
    if (!organization) throw forbidden();
    const query = prefixQuery(input.q);
    const empty = { query: input.q, suppliers: [], initiatives: [], actions: [] };
    if (!query) return empty;

    if (organization.buyer) {
      return this.tenant.run(
        { userId: auth.userId, organizationId: organization.id },
        async (tx) =>
          searchResultsSchema.parse({
            query: input.q,
            suppliers: await this.suppliers(tx, organization.id, query, input.q),
            initiatives: await this.initiatives(tx, query, null, 'buyer'),
            actions: await this.actions(tx, query, null, 'buyer'),
          }),
        { readOnly: true },
      );
    }
    // Lieferantenseite: nur im Kontext des aktuellen Kunden (LIF-02); ohne Kunde keine Treffer.
    if (!input.kunde) return empty;
    const relationshipId = input.kunde;
    return this.customers.inCustomer(auth, relationshipId, async (tx) =>
      searchResultsSchema.parse({
        query: input.q,
        suppliers: [],
        initiatives: await this.initiatives(tx, query, relationshipId, 'supplier'),
        actions: await this.actions(tx, query, relationshipId, 'supplier'),
      }),
    );
  }

  private async suppliers(tx: TenantTransaction, orgId: string, query: string, raw: string) {
    // Eigene Nummern wie „L-10001“ zerlegt der Parser; sie suchen deshalb zusätzlich als Anfang.
    const refPrefix = `${raw.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const result = await tx.execute<Row & { external_ref: string | null }>(sql`
      select r.id, r.id as relationship_id,
        coalesce(rs.display_name, o.name) as title, rs.external_ref as detail
      from relationship r
      join organization o on o.id = r.supplier_org_id
      left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = ${orgId}
      where r.buyer_org_id = ${orgId}
        and (
          to_tsvector('german', o.name) @@ to_tsquery('german', ${query})
          or to_tsvector('english', o.name) @@ to_tsquery('english', ${query})
          or to_tsvector('simple', coalesce(rs.display_name, '') || ' ' || coalesce(rs.external_ref, ''))
            @@ to_tsquery('simple', ${query})
          or rs.external_ref ilike ${refPrefix}
        )
      order by ts_rank(to_tsvector('german', o.name), to_tsquery('german', ${query})) desc, title
      limit ${maxHitsPerKind}
    `);
    return result.rows.map(
      (row): SearchHit => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        href: `/lieferanten/${row.relationship_id}`,
      }),
    );
  }

  /** Name des Lieferanten (Käufer) als Zusatz; beim Lieferanten steht der Kunde schon fest. */
  private supplierName(side: 'buyer' | 'supplier') {
    return side === 'buyer'
      ? sql`(select coalesce(rs.display_name, o.name) from relationship r
            join organization o on o.id = r.supplier_org_id
            left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
            where r.id = t.relationship_id)`
      : sql`null::text`;
  }

  private async initiatives(
    tx: TenantTransaction,
    query: string,
    relationshipId: string | null,
    side: 'buyer' | 'supplier',
  ) {
    const result = await tx.execute<Row>(sql`
      select t.id, t.relationship_id, t.title, ${this.supplierName(side)} as detail
      from initiative t
      where (${relationshipId}::uuid is null or t.relationship_id = ${relationshipId}::uuid)
        and (
          to_tsvector('german', t.title || ' ' || t.goal) @@ to_tsquery('german', ${query})
          or to_tsvector('english', t.title || ' ' || t.goal) @@ to_tsquery('english', ${query})
        )
      order by ts_rank(to_tsvector('german', t.title || ' ' || t.goal), to_tsquery('german', ${query})) desc,
        t.title
      limit ${maxHitsPerKind}
    `);
    return result.rows.map(
      (row): SearchHit => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        // Beim Lieferanten gibt es keine eigene Seite je Initiative; die Liste zeigt sie.
        href:
          side === 'buyer'
            ? `/lieferanten/${row.relationship_id}/plan/initiativen/${row.id}`
            : `/kunden/${row.relationship_id}/plan/initiativen`,
      }),
    );
  }

  private async actions(
    tx: TenantTransaction,
    query: string,
    relationshipId: string | null,
    side: 'buyer' | 'supplier',
  ) {
    const result = await tx.execute<Row>(sql`
      select t.id, t.relationship_id, t.title, ${this.supplierName(side)} as detail
      from action t
      where (${relationshipId}::uuid is null or t.relationship_id = ${relationshipId}::uuid)
        and (
          to_tsvector('german', t.title) @@ to_tsquery('german', ${query})
          or to_tsvector('english', t.title) @@ to_tsquery('english', ${query})
        )
      order by ts_rank(to_tsvector('german', t.title), to_tsquery('german', ${query})) desc,
        t.due_date
      limit ${maxHitsPerKind}
    `);
    return result.rows.map(
      (row): SearchHit => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        href: `/${side === 'buyer' ? 'lieferanten' : 'kunden'}/${row.relationship_id}/umsetzung/massnahmen/${row.id}`,
      }),
    );
  }
}
