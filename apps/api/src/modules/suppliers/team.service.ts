import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  defaultSroDescription,
  defaultTeamVisibility,
  type RoleDescription,
  type SaveRoleDescription,
  type TeamError,
  type TeamResponse,
  teamErrors,
  teamResponseSchema,
  type UpdateTeamRequest,
  updateTeamRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipTeamAudit, roleDescriptionAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';

/**
 * Team je Beziehung (PLT-05b, PLB-04): Jede Seite pflegt ihr Team und legt je Person fest, ob die
 * andere Seite sie sieht. Die Tabelle ist geteilt; interne Mitglieder sieht die andere Seite nie.
 * Käufer: Admin oder SRO pflegen; Lieferant: Admin oder Key Account Manager (Teamrolle „sro“).
 */
@Injectable()
export class TeamService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  private scoped<T>(
    auth: AuthContext,
    side: TeamSide,
    relationshipId: string,
    work: (scope: TeamScope) => Promise<T>,
  ): Promise<T> {
    if (side === 'supplier') {
      return this.customers.inCustomer(auth, relationshipId, async (tx) =>
        work(await scopeOf(tx, auth, auth.organization?.id as string, 'supplier', relationshipId)),
      );
    }
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      return work(await scopeOf(tx, auth, organization.id, 'buyer', relationshipId));
    });
  }

  team(auth: AuthContext, relationshipId: string, side: TeamSide = 'buyer'): Promise<TeamResponse> {
    return this.scoped(auth, side, relationshipId, (scope) => readTeam(scope));
  }

  /** Setzt das eigene Team auf einmal, mit Verlauf vorher und nachher samt Sichtbarkeit. */
  async setTeam(
    auth: AuthContext,
    relationshipId: string,
    input: UpdateTeamRequest,
    side: TeamSide = 'buyer',
  ): Promise<TeamResponse> {
    const parsed = updateTeamRequestSchema.safeParse(input);
    if (!parsed.success) {
      // Verstöße gegen die Grenzen eines Teams sind Konflikte (409), alles andere ein Formfehler.
      const code = teamErrors.find((known) => known === parsed.error.issues[0]?.message);
      if (code) throw conflict(code);
      throw new BadRequestException({ message: 'Ungültige Eingabe' });
    }
    const request = parsed.data;
    return this.scoped(auth, side, relationshipId, async (scope) => {
      if (!scope.canEdit) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      const { tx } = scope;
      const before = await readTeam(scope);
      const people = new Map(before.candidates.map((person) => [person.userId, person.name]));
      const outside = request.members.find((member) => !people.has(member.userId));
      if (outside) {
        throw new ConflictException({
          statusCode: 409,
          code: 'nicht_in_organisation',
          message: 'Ins Team kommen nur Personen der eigenen Organisation.',
        });
      }
      const own = and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.orgId, scope.orgId),
      );
      const joined = new Map(
        (
          await tx
            .select({
              userId: schema.relationshipMember.userId,
              createdAt: schema.relationshipMember.createdAt,
            })
            .from(schema.relationshipMember)
            .where(own)
        ).map((row) => [row.userId, row.createdAt]),
      );
      const members = request.members.map((member) => ({
        ...member,
        visibility: member.visibility ?? defaultTeamVisibility(member.teamRole),
      }));
      const summary = (
        list: { userId: string; teamRole: string; function: string | null; visibility: string }[],
      ) =>
        [...list]
          .sort((a, b) => a.userId.localeCompare(b.userId))
          .map((member) => ({
            name: people.get(member.userId) ?? member.userId,
            team_role: member.teamRole,
            function: member.function,
            visibility: member.visibility,
          }));

      const actor = await actorOf(tx, auth, scope.orgId);
      await auditedChange(tx, actor, relationshipTeamAudit, async () => {
        // Erst das eigene Team löschen, dann neu anlegen: So stört ein Rollentausch (z. B. neuer
        // SRO) die Grenzen nicht. Seit wann jemand im Team ist, bleibt erhalten. Nie die Zeilen der
        // anderen Seite: Die Bedingung auf die eigene Organisation steht ausdrücklich da.
        await tx.delete(schema.relationshipMember).where(own);
        if (members.length > 0) {
          await tx.insert(schema.relationshipMember).values(
            members.map((member) => ({
              relationshipId,
              orgId: scope.orgId,
              ownerOrgId: scope.orgId,
              userId: member.userId,
              teamRole: member.teamRole,
              function: member.function,
              visibility: member.visibility,
              memberName: people.get(member.userId) ?? null,
              ...(joined.has(member.userId) ? { createdAt: joined.get(member.userId) } : {}),
            })),
          );
        }
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated',
          before: { team: summary(before.members) },
          after: { team: summary(members) },
          result: undefined,
        };
      });
      return readTeam({ ...scope, canEdit: scope.canEdit });
    });
  }

  /** PLB-04: Rollenbeschreibung der eigenen Organisation (Käufer); ohne Zeile der Standard. */
  roles(auth: AuthContext): Promise<RoleDescription[]> {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => [
      await roleDescriptionOf(tx, organization.id, 'sro'),
    ]);
  }

  saveRole(
    auth: AuthContext,
    role: string,
    input: SaveRoleDescription,
  ): Promise<RoleDescription[]> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    if (role !== 'sro') throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const before = await roleDescriptionOf(tx, organization.id, role);
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, roleDescriptionAudit, async () => {
        await tx
          .insert(schema.roleDescription)
          .values({
            orgId: organization.id,
            role,
            does: input.does,
            doesNot: input.doesNot,
            updatedBy: auth.userId,
            updatedByName: actor.name,
          })
          .onConflictDoUpdate({
            target: [schema.roleDescription.orgId, schema.roleDescription.role],
            set: {
              does: input.does,
              doesNot: input.doesNot,
              updatedBy: auth.userId,
              updatedByName: actor.name,
              updatedAt: new Date(),
            },
          });
        return {
          objectId: organization.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { role, does: before.does.join(' · '), does_not: before.doesNot.join(' · ') },
          after: { role, does: input.does.join(' · '), does_not: input.doesNot.join(' · ') },
          result: undefined,
        };
      });
      return [await roleDescriptionOf(tx, organization.id, 'sro')];
    });
  }
}

type TeamSide = 'buyer' | 'supplier';

interface TeamScope {
  tx: TenantTransaction;
  auth: AuthContext;
  orgId: string;
  side: TeamSide;
  relationshipId: string;
  canEdit: boolean;
}

async function scopeOf(
  tx: TenantTransaction,
  auth: AuthContext,
  orgId: string,
  side: TeamSide,
  relationshipId: string,
): Promise<TeamScope> {
  const [member] = await tx
    .select({ teamRole: schema.relationshipMember.teamRole })
    .from(schema.relationshipMember)
    .where(
      and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.orgId, orgId),
        eq(schema.relationshipMember.userId, auth.userId),
      ),
    );
  const teamRole = member?.teamRole ?? null;
  // Admin immer (auch um sich als Leser wieder freizuschalten), sonst SRO bzw. Key Account Manager.
  const canEdit =
    auth.orgRole === 'admin' || (can(auth, 'team.festlegen', { teamRole }) && teamRole === 'sro');
  return { tx, auth, orgId, side, relationshipId, canEdit };
}

async function roleDescriptionOf(
  tx: TenantTransaction,
  orgId: string,
  role: string,
): Promise<RoleDescription> {
  const [row] = await tx
    .select()
    .from(schema.roleDescription)
    .where(and(eq(schema.roleDescription.orgId, orgId), eq(schema.roleDescription.role, role)));
  return row
    ? {
        role,
        does: row.does as string[],
        doesNot: row.doesNot as string[],
        updatedByName: row.updatedByName,
      }
    : { role, ...defaultSroDescription, updatedByName: null };
}

const roleOrder = { sro: 0, sponsor: 1, member: 2, viewer: 3 } as const;

async function readTeam(scope: TeamScope): Promise<TeamResponse> {
  const { tx, orgId, relationshipId } = scope;
  const { appUser, relationshipMember } = schema;
  const rows = await tx
    .select({
      orgId: relationshipMember.orgId,
      userId: relationshipMember.userId,
      memberName: relationshipMember.memberName,
      name: appUser.name,
      teamRole: relationshipMember.teamRole,
      function: relationshipMember.function,
      visibility: relationshipMember.visibility,
    })
    .from(relationshipMember)
    .leftJoin(appUser, eq(appUser.id, relationshipMember.userId))
    .where(eq(relationshipMember.relationshipId, relationshipId));
  const order = <T extends { teamRole: keyof typeof roleOrder; name: string }>(list: T[]) =>
    list.sort(
      (a, b) => roleOrder[a.teamRole] - roleOrder[b.teamRole] || a.name.localeCompare(b.name, 'de'),
    );
  const members = order(
    rows
      .filter((row) => row.orgId === orgId)
      .map((row) => ({
        userId: row.userId,
        name: row.name ?? row.memberName ?? row.userId,
        teamRole: row.teamRole,
        function: row.function,
        visibility: row.visibility,
      })),
  );
  // Die andere Seite: RLS liefert nur geteilte Mitglieder; ihre Namen stehen in der Zeile.
  const counterpart = order(
    rows
      .filter((row) => row.orgId !== orgId && row.visibility === 'shared')
      .map((row) => ({
        name: row.memberName ?? '',
        teamRole: row.teamRole,
        function: row.function,
      })),
  );
  const candidates = await tx
    .select({ userId: appUser.id, name: appUser.name, defaultFunction: appUser.defaultFunction })
    .from(appUser)
    .where(eq(appUser.organizationId, orgId))
    .orderBy(asc(appUser.name));
  return teamResponseSchema.parse({
    side: scope.side,
    members,
    counterpart,
    candidates: scope.canEdit ? candidates : [],
    canEdit: scope.canEdit,
    sroDescription: scope.side === 'buyer' ? await roleDescriptionOf(tx, orgId, 'sro') : null,
  });
}

/** Der SRO einer Beziehung oder null (PLT-05b); der Kopf des Arbeitsbereichs liest ihn hier (NAV-06). */
export async function sroOf(
  tx: TenantTransaction,
  organization: AccountOrganization,
  relationshipId: string,
): Promise<{ userId: string; name: string } | null> {
  const { appUser, relationshipMember } = schema;
  const [row] = await tx
    .select({ userId: relationshipMember.userId, name: appUser.name })
    .from(relationshipMember)
    .innerJoin(appUser, eq(appUser.id, relationshipMember.userId))
    .where(
      and(
        eq(relationshipMember.relationshipId, relationshipId),
        eq(relationshipMember.orgId, organization.id),
        eq(relationshipMember.teamRole, 'sro'),
      ),
    );
  return row ?? null;
}

/** 404, wenn die Beziehung nicht zur eigenen Organisation als Käufer gehört. */
export async function ownRelationship(
  tx: TenantTransaction,
  organization: AccountOrganization,
  relationshipId: string,
) {
  const [row] = await tx
    .select({ id: schema.relationship.id })
    .from(schema.relationship)
    .where(
      and(
        eq(schema.relationship.id, relationshipId),
        eq(schema.relationship.buyerOrgId, organization.id),
      ),
    );
  if (!row) throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
}

const teamMessages: Record<TeamError, string> = {
  duplicate_person: 'Jede Person steht nur einmal im Team.',
  too_many_sro: 'Ein Team hat höchstens einen SRO.',
  too_many_sponsors: 'Ein Team hat höchstens zwei Sponsoren.',
};

function conflict(code: TeamError) {
  return new ConflictException({ statusCode: 409, code, message: teamMessages[code] });
}
