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
      ${user.userId}, ${user.name}, ${user.givenName}, ${user.email}, ${user.zitadelOrgId}, ${user.login}
    )`);
  }

  async organizationOf(userId: string): Promise<AccountOrganization | null> {
    const result = await this.db.execute<AccountOrganization>(
      sql`select id, name, country, buyer from app_organisation_des_nutzers(${userId})`,
    );
    return result.rows[0] ?? null;
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
