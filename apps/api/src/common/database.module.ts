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
import type { OrgRole } from '@reziproq/shared';

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

  run<T>(session: TenantSession, work: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    return withTenant(this.db, session, work);
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
      ${user.login}, ${`{${user.tokenRoles.join(',')}}`}::text[]
    )`);
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
  ],
  exports: [TenantDatabase, AccountStore],
})
export class DatabaseModule {}
