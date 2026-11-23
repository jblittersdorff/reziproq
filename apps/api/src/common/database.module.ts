import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  apiDatabaseUrl,
  createDatabase,
  type Database,
  sql,
  type TenantSession,
  type TenantTransaction,
  withTenant,
} from '@reziproq/db';
import type { OrgRole, UserLocale } from '@reziproq/shared';

// Die API verbindet sich als reziproq_api: nicht Eigentümer der Tabellen, ohne Sonderrechte
// (PLT-02). Die Verbindung selbst verlässt dieses Modul nicht. Module kommen an Daten nur über
// TenantDatabase (Mandanten-Session) oder über die eng gefassten Funktionen in AccountStore.
// Dass kein Modul die Verbindung direkt nutzt, prüft common/database.module.test.ts.

export const DATABASE = Symbol('DATABASE');

@Injectable()
class DatabaseConnection implements OnApplicationShutdown {
  readonly connection = createDatabase(apiDatabaseUrl());

  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}

/** Mandanten-Session: Jede Abfrage auf Fachdaten läuft mit gesetztem app.user_id und app.org_id. */
@Injectable()
export class TenantDatabase {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  run<T>(
    session: TenantSession,
    work: (tx: TenantTransaction) => Promise<T>,
    options?: { readOnly?: boolean },
  ): Promise<T> {
    return withTenant(this.db, session, work, options);
  }
}

/** Organisation einer Person, wie sie vor der Mandanten-Session feststeht. */
export type AccountOrganization = {
  id: string;
  name: string;
  country: string | null;
  /** Feature buyer: darf Käuferfunktionen nutzen (PLT-02). */
  buyer: boolean;
};

export interface AccountSync {
  userId: string;
  name: string;
  givenName: string | null;
  email: string;
  zitadelOrgId: string | null;
  login: boolean;
  /** Rollen aus dem Token; nur für die einmalige Übernahme beim Login (PLT-05). */
  tokenRoles: readonly string[];
  /** Browsersprache beim Login; gilt nur, solange keine Sprache gespeichert ist (PLT-09). */
  browserLocale: UserLocale | null;
}

/** Organisation einer Person mit ihrer Rolle darin (PLT-05). */
export interface AccountMembership {
  organization: AccountOrganization;
  orgRole: OrgRole;
  isControlling: boolean;
}

/**
 * Was vor der Mandanten-Session passieren muss: Login, eigene Organisation, Betreiber-Zugang.
 * Läuft über Datenbankfunktionen mit genau diesen Rechten (drizzle/0007_organisationen.sql).
 */
@Injectable()
export class AccountStore {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async syncUser(user: AccountSync): Promise<void> {
    await this.db.execute(sql`select app_nutzer_synchronisieren(
      ${user.userId}, ${user.name}, ${user.givenName}, ${user.email}, ${user.zitadelOrgId},
      ${user.login}, ${`{${user.tokenRoles.join(',')}}`}::text[], ${user.browserLocale}
    )`);
  }

  /** Gespeicherte Sprache (PLT-09); ohne gespeicherte Sprache Deutsch. */
  async localeOf(userId: string): Promise<UserLocale> {
    const result = await this.db.execute<{ locale: UserLocale }>(
      sql`select app_sprache_des_nutzers(${userId}) as locale`,
    );
    return result.rows[0]?.locale ?? 'de';
  }

  /** Nur die eigene Sprache: userId kommt aus dem geprüften Token. */
  async setLocale(userId: string, locale: UserLocale): Promise<void> {
    await this.db.execute(sql`select app_sprache_setzen(${userId}, ${locale})`);
  }

  async membershipOf(userId: string): Promise<AccountMembership | null> {
    const result = await this.db.execute<
      AccountOrganization & { org_role: OrgRole; is_controlling: boolean }
    >(
      sql`select id, name, country, buyer, org_role, is_controlling from app_organisation_des_nutzers(${userId})`,
    );
    const row = result.rows[0];
    if (!row) return null;
    const { org_role, is_controlling, ...organization } = row;
    return { organization, orgRole: org_role, isControlling: is_controlling };
  }

  /** Betreiber-Team von Reziproq (UMB-01): nur das Flag in der Datenbank zählt. */
  async isOperator(userId: string): Promise<boolean> {
    const result = await this.db.execute<{ yes: boolean }>(
      sql`select app_ist_betreiber(${userId}) as yes`,
    );
    return result.rows[0]?.yes === true;
  }

  /** Organisationen mit Käuferfunktionen: die Kunden, in die ein Betreiber wechseln kann. */
  async customers(): Promise<{ id: string; name: string; country: string | null }[]> {
    const result = await this.db.execute<{ id: string; name: string; country: string | null }>(
      sql`select id, name, country from app_betreiber_kunden()`,
    );
    return result.rows;
  }

  async recordSupportAccess(userId: string, organizationId: string | null, action: string) {
    await this.db.execute(
      sql`select app_betreiber_protokoll(${userId}, ${organizationId}::uuid, ${action})`,
    );
  }
}

/** Zeile aus app_einladung_lesen (LIF-01a): status open, expired, used oder revoked. */
export interface InvitationLookup {
  status: 'open' | 'expired' | 'used' | 'revoked';
  customer: string;
  sro: string | null;
  supplier: string;
  supplier_org_id: string;
  zitadel_org_id: string | null;
  email: string;
  kam_taken: boolean;
}

/**
 * Einladung ohne Login lesen und annehmen (LIF-01a), nur über app_einladung_lesen und
 * app_einladung_annehmen. Beide bekommen den SHA-256 des Tokens, nie den Token.
 */
@Injectable()
export class InvitationStore {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async lookup(tokenHash: string): Promise<InvitationLookup | null> {
    const result = await this.db.execute<InvitationLookup & Record<string, unknown>>(
      sql`select * from app_einladung_lesen(${tokenHash})`,
    );
    return result.rows[0] ?? null;
  }

  async accept(input: {
    tokenHash: string;
    userId: string;
    name: string;
    givenName: string;
    email: string;
    zitadelOrgId: string;
    teamRole: string;
    locale: UserLocale;
  }): Promise<void> {
    await this.db.execute(sql`
      select * from app_einladung_annehmen(
        ${input.tokenHash}, ${input.userId}, ${input.name}, ${input.givenName}, ${input.email},
        ${input.zitadelOrgId}, ${input.teamRole}, ${input.locale}
      )
    `);
  }
}

/** PUL-02b: Zeile aus app_umfrage_lesen. */
export interface SurveyLinkRow {
  status: 'open' | 'used' | 'expired';
  kind: 'pulse' | 'annual';
  due_date: string;
  side: 'buyer' | 'supplier';
  buyer: string;
  supplier: string;
  questions: unknown;
}

/**
 * Beantworten ohne Anmeldung (PUL-02b): genau zwei Funktionen als reziproq_umfrage. Sie kennen nur
 * den Hash des Tokens und schreiben einen Antwortbogen ohne Bezug zur Person.
 */
@Injectable()
export class SurveyLinkStore {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async read(tokenHash: string): Promise<SurveyLinkRow | null> {
    const result = await this.db.execute<SurveyLinkRow & Record<string, unknown>>(
      sql`select status, kind, due_date::text as due_date, side, buyer, supplier, questions
          from app_umfrage_lesen(${tokenHash})`,
    );
    return result.rows[0] ?? null;
  }

  async submit(tokenHash: string, answers: unknown, comment: string | null): Promise<void> {
    await this.db.execute(
      sql`select app_umfrage_absenden(${tokenHash}, ${JSON.stringify(answers)}::jsonb, ${comment})`,
    );
  }
}

/**
 * QBR-04: Für welche Organisationen der tägliche Maßnahmen-Job eine Mandanten-Session öffnet.
 * app_action_due_orgs liefert nur IDs (Lieferant mit Kunde), keine Inhalte.
 */
@Injectable()
export class ActionDueStore {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async organizations(
    from: string,
    to: string,
  ): Promise<{ orgId: string; customerOrgId: string | null }[]> {
    const result = await this.db.execute<{ org_id: string; customer_org_id: string | null }>(
      sql`select org_id::text, customer_org_id::text from app_action_due_orgs(${from}::date, ${to}::date)`,
    );
    return result.rows.map((row) => ({ orgId: row.org_id, customerOrgId: row.customer_org_id }));
  }

  /** FS-01: Käufer mit aktiven Beziehungen, für den täglichen Hinweis-Job; nur IDs. */
  async hintOrganizations(): Promise<string[]> {
    const result = await this.db.execute<{ org_id: string }>(
      sql`select org_id::text from app_hint_orgs()`,
    );
    return result.rows.map((row) => row.org_id);
  }
}

/**
 * IN-01: Was die Integrationsschicht vor der Mandanten-Session braucht: zu einem Webhook-Pfad
 * Organisation und Verbindung, für den Job „Erneuern“ die Organisationen mit aktiven Verbindungen.
 * Nur IDs, über Datenbankfunktionen mit genau diesen Rechten (drizzle/0111, 0112).
 */
@Injectable()
export class IntegrationStore {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async hook(token: string): Promise<{ orgId: string; connectionId: string } | null> {
    const result = await this.db.execute<{ org_id: string; connection_id: string }>(
      sql`select org_id::text, connection_id::text from app_inbound_hook(${token})`,
    );
    const row = result.rows[0];
    return row ? { orgId: row.org_id, connectionId: row.connection_id } : null;
  }

  /** IN-07: Schlüssel der Import-API zum Hash; nur IDs, Objektarten und Widerruf (drizzle/0113) */
  async apiKey(hash: string): Promise<{
    id: string;
    orgId: string;
    scopes: string[];
    createdBy: string;
    revoked: boolean;
  } | null> {
    const result = await this.db.execute<{
      id: string;
      org_id: string;
      scopes: string[];
      created_by: string;
      revoked_at: string | null;
    }>(sql`select id::text, org_id::text, scopes, created_by, revoked_at from app_api_key(${hash})`);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          orgId: row.org_id,
          scopes: row.scopes,
          createdBy: row.created_by,
          revoked: row.revoked_at !== null,
        }
      : null;
  }

  async organizations(): Promise<string[]> {
    const result = await this.db.execute<{ org_id: string }>(
      sql`select org_id::text from app_connection_orgs()`,
    );
    return result.rows.map((row) => row.org_id);
  }
}

@Global()
@Module({
  providers: [
    DatabaseConnection,
    {
      provide: DATABASE,
      useFactory: (conn: DatabaseConnection): Database => conn.connection.db,
      inject: [DatabaseConnection],
    },
    TenantDatabase,
    AccountStore,
    InvitationStore,
    SurveyLinkStore,
    ActionDueStore,
    IntegrationStore,
  ],
  exports: [
    TenantDatabase,
    AccountStore,
    InvitationStore,
    SurveyLinkStore,
    ActionDueStore,
    IntegrationStore,
  ],
})
export class DatabaseModule {}
