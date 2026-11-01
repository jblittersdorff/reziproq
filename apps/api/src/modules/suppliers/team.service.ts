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
  type TeamError,
  type TeamResponse,
  teamErrors,
  type UpdateTeamRequest,
  updateTeamRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipTeamAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';

/**
 * Internes Team je Beziehung (PLT-05b): SRO, Sponsoren, Mitglieder und Leser der eigenen
 * Organisation. Die Datenbank hält das Team je Organisation getrennt (org_private).
 */
@Injectable()
export class TeamService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  async team(auth: AuthContext, relationshipId: string): Promise<TeamResponse> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      return readTeam(tx, organization, relationshipId);
    });
  }

  /** Setzt das ganze Team auf einmal, mit internem Verlauf vorher und nachher. */
  async setTeam(
    auth: AuthContext,
    relationshipId: string,
    input: UpdateTeamRequest,
  ): Promise<TeamResponse> {
    const organization = this.organization(auth);
    const parsed = updateTeamRequestSchema.safeParse(input);
    if (!parsed.success) {
      // Verstöße gegen die Grenzen eines Teams sind Konflikte (409), alles andere ein Formfehler.
      const code = teamErrors.find((known) => known === parsed.error.issues[0]?.message);
      if (code) throw conflict(code);
      throw new BadRequestException({ message: 'Ungültige Eingabe' });
    }
    const request = parsed.data;

    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const before = await readTeam(tx, organization, relationshipId);
      const people = new Map(before.candidates.map((person) => [person.userId, person.name]));
      const outside = request.members.find((member) => !people.has(member.userId));
      if (outside) {
        throw new ConflictException({
          statusCode: 409,
          code: 'nicht_in_organisation',
          message: 'Ins Team kommen nur Personen der eigenen Organisation.',
        });
      }
      const joined = new Map(
        (
          await tx
            .select({
              userId: schema.relationshipMember.userId,
              createdAt: schema.relationshipMember.createdAt,
            })
            .from(schema.relationshipMember)
            .where(eq(schema.relationshipMember.relationshipId, relationshipId))
        ).map((row) => [row.userId, row.createdAt]),
      );

      const summary = (members: { userId: string; teamRole: string; function: string | null }[]) =>
        [...members]
          .sort((a, b) => a.userId.localeCompare(b.userId))
          .map((member) => ({
            name: people.get(member.userId) ?? member.userId,
            team_role: member.teamRole,
            function: member.function,
          }));

      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, relationshipTeamAudit, async () => {
        // Erst alles löschen, dann neu anlegen: So stört ein Rollentausch (z. B. neuer SRO)
        // die Grenzen nicht. Seit wann jemand im Team ist, bleibt erhalten.
        await tx
          .delete(schema.relationshipMember)
          .where(eq(schema.relationshipMember.relationshipId, relationshipId));
        if (request.members.length > 0) {
          await tx.insert(schema.relationshipMember).values(
            request.members.map((member) => ({
              relationshipId,
              orgId: organization.id,
              userId: member.userId,
              teamRole: member.teamRole,
              function: member.function,
              ...(joined.has(member.userId) ? { createdAt: joined.get(member.userId) } : {}),
            })),
          );
        }
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated',
          before: { team: summary(before.members) },
          after: { team: summary(request.members) },
          result: undefined,
        };
      });
      return readTeam(tx, organization, relationshipId);
    });
  }
}

const roleOrder = { sro: 0, sponsor: 1, member: 2, viewer: 3 } as const;

async function readTeam(
  tx: TenantTransaction,
  organization: AccountOrganization,
  relationshipId: string,
): Promise<TeamResponse> {
  const { appUser, relationshipMember } = schema;
  const members = await tx
    .select({
      userId: relationshipMember.userId,
      name: appUser.name,
      teamRole: relationshipMember.teamRole,
      function: relationshipMember.function,
    })
    .from(relationshipMember)
    .innerJoin(appUser, eq(appUser.id, relationshipMember.userId))
    .where(
      and(
        eq(relationshipMember.relationshipId, relationshipId),
        eq(relationshipMember.orgId, organization.id),
      ),
    );
  const candidates = await tx
    .select({ userId: appUser.id, name: appUser.name, defaultFunction: appUser.defaultFunction })
    .from(appUser)
    .where(eq(appUser.organizationId, organization.id))
    .orderBy(asc(appUser.name));
  return {
    members: members.sort(
      (a, b) => roleOrder[a.teamRole] - roleOrder[b.teamRole] || a.name.localeCompare(b.name, 'de'),
    ),
    candidates,
  };
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
