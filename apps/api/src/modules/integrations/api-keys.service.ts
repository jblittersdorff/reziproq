import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, isNull, schema, type TenantTransaction } from '@reziproq/db';
import type { ApiKeys, ApiObjectType, CreateApiKey, CreatedApiKey } from '@reziproq/shared';
import { IntegrationStore, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { actorIn } from './actor.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const unauthorized = () => new UnauthorizedException({ statusCode: 401, code: 'schluessel_ungueltig' });

export const hashApiKey = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** Wer mit einem API-Schlüssel aufruft: Schlüssel, Kunde, Objektarten und die handelnde Person */
export interface ApiPrincipal {
  keyId: string;
  keyName: string;
  orgId: string;
  scopes: ApiObjectType[];
  /** Die Person, die den Schlüssel erzeugt hat, mit ihrer heutigen Rolle */
  actor: AuthContext;
}

/**
 * IN-07: API-Schlüssel der Import-API. Erzeugen, widerrufen und auf Objektarten beschränken nur
 * Admins. Der Schlüssel steht einmal in der Antwort und sonst nur als SHA-256-Hash in der Datenbank.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(IntegrationStore) private readonly store: IntegrationStore,
  ) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  list(auth: AuthContext): Promise<ApiKeys> {
    const session = this.session(auth);
    return this.tenant.run(session, (tx) => this.listIn(tx, session.organizationId), {
      readOnly: true,
    });
  }

  private async listIn(tx: TenantTransaction, orgId: string): Promise<ApiKeys> {
    const keys = await tx
      .select({ key: schema.apiKey, createdByName: schema.appUser.name })
      .from(schema.apiKey)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.apiKey.createdBy))
      .where(eq(schema.apiKey.orgId, orgId))
      .orderBy(desc(schema.apiKey.createdAt));
    const [last] = await tx
      .select()
      .from(schema.importBatch)
      .where(
        and(
          eq(schema.importBatch.orgId, orgId),
          eq(schema.importBatch.source, 'api'),
          isNull(schema.importBatch.deliveryId),
        ),
      )
      .orderBy(desc(schema.importBatch.createdAt))
      .limit(1);
    return {
      keys: keys.map(({ key, createdByName }) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes as ApiObjectType[],
        createdByName: createdByName ?? '',
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
      })),
      lastDelivery: last
        ? {
            batchId: last.id,
            createdAt: last.createdAt.toISOString(),
            status: last.status,
            rowsTotal: last.rowsTotal + last.apiErrors.length,
            rowsError: last.rowsError + last.apiErrors.length,
          }
        : null,
    };
  }

  async create(auth: AuthContext, input: CreateApiKey): Promise<CreatedApiKey> {
    const session = this.session(auth);
    const prefix = `rzq_${randomBytes(4).toString('hex')}`;
    const secret = `${prefix}_${randomBytes(24).toString('base64url')}`;
    return this.tenant.run(session, async (tx) => {
      await tx.insert(schema.apiKey).values({
        orgId: session.organizationId,
        name: input.name,
        prefix,
        hash: hashApiKey(secret),
        scopes: [...new Set(input.scopes)],
        createdBy: auth.userId,
      });
      return { ...(await this.listIn(tx, session.organizationId)), secret };
    });
  }

  async revoke(auth: AuthContext, id: string): Promise<ApiKeys> {
    const session = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      const [revoked] = await tx
        .update(schema.apiKey)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.apiKey.id, id), isNull(schema.apiKey.revokedAt)))
        .returning({ id: schema.apiKey.id });
      if (!revoked) throw notFound();
      return this.listIn(tx, session.organizationId);
    });
  }

  /** Anmeldung mit Authorization: Bearer <Schlüssel>; widerrufen oder unbekannt ergibt 401. */
  async authenticate(header: string | undefined): Promise<ApiPrincipal> {
    const secret = header?.match(/^Bearer\s+(rzq_[A-Za-z0-9_-]{8,200})$/)?.[1];
    if (!secret) throw unauthorized();
    const key = await this.store.apiKey(hashApiKey(secret));
    if (!key || key.revoked) throw unauthorized();
    const found = await this.tenant.run(
      { userId: key.createdBy, organizationId: key.orgId },
      async (tx) => {
        const [row] = await tx
          .update(schema.apiKey)
          .set({ lastUsedAt: new Date() })
          .where(eq(schema.apiKey.id, key.id))
          .returning({ name: schema.apiKey.name });
        return { name: row?.name ?? '', actor: await actorIn(tx, key.orgId, key.createdBy) };
      },
    );
    // Gehört die Person nicht mehr dazu oder ist kein Admin mehr, gilt der Schlüssel nicht mehr
    if (!found.actor?.organization?.buyer || !can(found.actor, 'einstellungen.verwalten')) {
      throw unauthorized();
    }
    return {
      keyId: key.id,
      keyName: found.name,
      orgId: key.orgId,
      scopes: key.scopes as ApiObjectType[],
      actor: found.actor,
    };
  }
}
