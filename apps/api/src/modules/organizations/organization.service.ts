import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, eq, schema, type TenantTransaction } from '@reziproq/db';
import type {
  OrganizationMember,
  OrganizationResponse,
  UpdateMemberRequest,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { userRoleAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';

@Injectable()
export class OrganizationService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  /**
   * Die Organisation, für die eine Anfrage gilt. Der Guard stellt sie vor der Mandanten-Session
   * fest: in der Betreiber-Ansicht der gewählte Kunde (PLT-13), sonst die eigene (PLT-02).
   */
  current(auth: AuthContext): AccountOrganization | null {
    return auth.organization;
  }

  private required(auth: AuthContext): AccountOrganization {
    const organization = this.current(auth);
    if (!organization) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_organisation' });
    }
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    organization: AccountOrganization,
    work: (tx: TenantTransaction) => Promise<T>,
  ) {
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, work);
  }

  /**
   * Name, Land und Mitglieder mit Rolle. Welche Mitglieder sichtbar sind, entscheidet allein
   * Row-Level Security auf app_user: die Abfrage selbst filtert nur nach der Organisation.
   */
  async withMembers(auth: AuthContext): Promise<OrganizationResponse> {
    const organization = this.required(auth);
    const members = await this.run(auth, organization, (tx) => membersOf(tx, organization.id));
    return { name: organization.name, country: organization.country, members };
  }

  async member(auth: AuthContext, userId: string): Promise<OrganizationMember> {
    const organization = this.required(auth);
    return this.run(auth, organization, (tx) => memberOf(tx, organization.id, userId));
  }

  /**
   * Rolle, Controlling und Standardfunktion ändern (PLT-05), mit internem Verlauf. Die Datenbank
   * lässt nur Admins ändern und hält mindestens einen Admin je Organisation.
   */
  async updateMember(
    auth: AuthContext,
    userId: string,
    request: UpdateMemberRequest,
  ): Promise<OrganizationMember> {
    const organization = this.required(auth);
    try {
      return await this.run(auth, organization, async (tx) => {
        const before = await memberOf(tx, organization.id, userId);
        const actor = await actorOf(tx, auth, organization.id);
        await auditedChange(tx, actor, userRoleAudit, async () => {
          await tx
            .update(schema.appUser)
            .set({
              orgRole: request.orgRole,
              isControlling: request.isControlling,
              defaultFunction: request.defaultFunction,
            })
            .where(eq(schema.appUser.id, userId));
          return {
            objectId: userId,
            relationshipId: null,
            action: 'updated',
            before: {
              org_role: before.orgRole,
              is_controlling: before.isControlling,
              default_function: before.defaultFunction,
            },
            after: {
              org_role: request.orgRole,
              is_controlling: request.isControlling,
              default_function: request.defaultFunction,
            },
            result: undefined,
          };
        });
        return memberOf(tx, organization.id, userId);
      });
    } catch (error) {
      if (isLastAdminError(error)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'letzter_admin',
          message: 'Es muss mindestens einen Admin geben.',
        });
      }
      throw error;
    }
  }
}

const memberColumns = {
  id: schema.appUser.id,
  name: schema.appUser.name,
  email: schema.appUser.email,
  orgRole: schema.appUser.orgRole,
  isControlling: schema.appUser.isControlling,
  defaultFunction: schema.appUser.defaultFunction,
};

function membersOf(tx: TenantTransaction, organizationId: string) {
  return tx
    .select(memberColumns)
    .from(schema.appUser)
    .where(eq(schema.appUser.organizationId, organizationId))
    .orderBy(asc(schema.appUser.name));
}

async function memberOf(
  tx: TenantTransaction,
  organizationId: string,
  userId: string,
): Promise<OrganizationMember> {
  const [member] = await tx
    .select(memberColumns)
    .from(schema.appUser)
    .where(and(eq(schema.appUser.organizationId, organizationId), eq(schema.appUser.id, userId)));
  if (!member) {
    throw new NotFoundException({
      statusCode: 404,
      code: 'nicht_gefunden',
      message: 'Mitglied nicht gefunden.',
    });
  }
  return member;
}

/** Der Trigger app_letzter_admin_bleibt meldet sich mit diesem Text (Migration 0013). */
function isLastAdminError(error: unknown): boolean {
  const cause = (error as { cause?: { message?: string } } | null)?.cause;
  return /mindestens einen Admin/.test(cause?.message ?? '');
}
