import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  type HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AcceptInvitationRequest,
  type AcceptInvitationResponse,
  type InvitationList,
  type InvitationStatus,
  type InviteSupplierRequest,
  invitationListSchema,
  invitationTokenSchema,
  invitationValidDays,
  type PublicInvitation,
  publicInvitationSchema,
  type UserLocale,
} from '@reziproq/shared';
import {
  type AccountOrganization,
  InvitationStore,
  TenantDatabase,
} from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { supplierInvitationAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { EmailService } from '../email/email.service.js';
import { IDENTITY_PROVISIONER, type IdentityProvisioner } from './identity-provisioner.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

/** Nur der SHA-256 des Tokens erreicht die Datenbank. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Fehler aus app_einladung_annehmen, übersetzt in Antworten der API. */
const unavailable = () =>
  new GoneException({
    statusCode: 410,
    code: 'invitation_unavailable',
    message: 'Die Einladung ist abgelaufen, zurückgezogen oder schon angenommen.',
  });
const kamTaken = () =>
  conflict('kam_taken', 'Für diese Beziehung gibt es schon einen Key Account Manager.');
const acceptErrors: Record<string, () => HttpException> = {
  invitation_not_found: notFound,
  invitation_unavailable: unavailable,
  invitation_kam_taken: kamTaken,
  invitation_user_other_org: () =>
    conflict('user_other_org', 'Diese Person gehört schon zu einer anderen Organisation.'),
  invitation_zitadel_mismatch: () =>
    conflict('zitadel_mismatch', 'Die Organisation passt nicht zum Lieferanten.'),
};

function statusOf(row: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InvitationStatus {
  if (row.acceptedAt) return 'accepted';
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'open';
}

/** Gültig bis, lesbar in der Sprache der Mail. */
function formatExpiry(date: Date, locale: UserLocale) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'Europe/Berlin',
  }).format(date);
}

/**
 * LIF-01a: Ein Käufer lädt Personen des Lieferanten ein; die Person nimmt ohne Login an. Einladen
 * und Zurückziehen laufen in der Mandanten-Session, Lesen und Annehmen nur über die Funktionen
 * app_einladung_lesen und app_einladung_annehmen (Migration 0035).
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(InvitationStore) private readonly store: InvitationStore,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(IDENTITY_PROVISIONER) private readonly identity: IdentityProvisioner,
  ) {}

  private buyer(auth: AuthContext): AccountOrganization {
    if (!auth.organization?.buyer) throw forbidden();
    return auth.organization;
  }

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, org: AccountOrganization) => Promise<T>,
  ) {
    const organization = this.buyer(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  /** Beziehung des eigenen Käufers, ihr SRO und ob die Person einladen darf. */
  private async context(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: AccountOrganization,
    relationshipId: string,
  ) {
    const [relationship] = await tx
      .select({ status: schema.relationship.status })
      .from(schema.relationship)
      .where(
        and(
          eq(schema.relationship.id, relationshipId),
          eq(schema.relationship.buyerOrgId, organization.id),
        ),
      );
    if (!relationship) throw notFound();
    const members = await tx
      .select({
        userId: schema.relationshipMember.userId,
        teamRole: schema.relationshipMember.teamRole,
        name: schema.appUser.name,
      })
      .from(schema.relationshipMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, organization.id),
        ),
      );
    const own = members.find((member) => member.userId === auth.userId);
    const sro = members.find((member) => member.teamRole === 'sro');
    // Admin oder SRO; mit Teamrolle Leser niemand (lieferanten.einladen, notForTeamViewer).
    const allowed =
      own?.teamRole !== 'viewer' &&
      (auth.orgRole === 'admin' || (auth.orgRole === 'member' && own?.teamRole === 'sro'));
    return {
      ended: relationship.status === 'ended',
      canInvite: allowed && relationship.status !== 'ended',
      sroName: sro?.name ?? null,
    };
  }

  list(auth: AuthContext, relationshipId: string): Promise<InvitationList> {
    return this.run(auth, async (tx, organization) => {
      const { canInvite } = await this.context(tx, auth, organization, relationshipId);
      return this.read(tx, organization, relationshipId, canInvite);
    });
  }

  private async read(
    tx: TenantTransaction,
    organization: AccountOrganization,
    relationshipId: string,
    canInvite: boolean,
  ): Promise<InvitationList> {
    const rows = await tx
      .select({
        id: schema.invitation.id,
        email: schema.invitation.email,
        invitedBy: schema.appUser.name,
        createdAt: schema.invitation.createdAt,
        expiresAt: schema.invitation.expiresAt,
        acceptedAt: schema.invitation.acceptedAt,
        revokedAt: schema.invitation.revokedAt,
      })
      .from(schema.invitation)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.invitation.invitedBy))
      .where(
        and(
          eq(schema.invitation.relationshipId, relationshipId),
          eq(schema.invitation.orgId, organization.id),
        ),
      )
      .orderBy(desc(schema.invitation.createdAt));
    const invitations = rows.map((row) => ({
      id: row.id,
      email: row.email,
      status: statusOf(row),
      invitedBy: row.invitedBy,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
    }));
    // Vorschläge aus den Kontakten (PLT-07b), ohne Adressen mit offener oder angenommener Einladung.
    const taken = new Set(
      invitations
        .filter((entry) => entry.status === 'open' || entry.status === 'accepted')
        .map((entry) => entry.email.toLowerCase()),
    );
    const contacts = canInvite
      ? await tx
          .select({ name: schema.supplierContact.name, email: schema.supplierContact.email })
          .from(schema.supplierContact)
          .where(eq(schema.supplierContact.relationshipId, relationshipId))
          .orderBy(schema.supplierContact.name)
      : [];
    return invitationListSchema.parse({
      invitations,
      canInvite,
      suggestions: contacts.filter((contact) => !taken.has(contact.email.toLowerCase())),
    });
  }

  invite(
    auth: AuthContext,
    relationshipId: string,
    input: InviteSupplierRequest,
    locale: UserLocale,
  ): Promise<InvitationList> {
    return this.run(auth, async (tx, organization) => {
      const context = await this.context(tx, auth, organization, relationshipId);
      if (context.ended) throw conflict('relationship_ended', 'Die Beziehung ist beendet.');
      if (!context.canInvite) throw forbidden();
      const email = input.email.toLowerCase();
      const [open] = await tx
        .select({ id: schema.invitation.id })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.relationshipId, relationshipId),
            eq(schema.invitation.orgId, organization.id),
            sql`lower(${schema.invitation.email}) = ${email}`,
            sql`${schema.invitation.acceptedAt} is null`,
            sql`${schema.invitation.revokedAt} is null`,
            sql`${schema.invitation.expiresAt} > now()`,
          ),
        );
      if (open) throw conflict('already_invited', 'Diese Person ist schon eingeladen.');

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + invitationValidDays * 24 * 60 * 60 * 1000);
      const actor = await actorOf(tx, auth, organization.id);
      const message = input.message ? input.message : undefined;
      await auditedChange(tx, actor, supplierInvitationAudit, async () => {
        const [row] = await tx
          .insert(schema.invitation)
          .values({
            relationshipId,
            orgId: organization.id,
            email,
            message: message ?? null,
            tokenHash: hashToken(token),
            invitedBy: auth.userId,
            expiresAt,
          })
          .returning({ id: schema.invitation.id });
        if (!row) throw new Error('Einladung nicht angelegt');
        return {
          objectId: row.id,
          relationshipId,
          action: 'created',
          after: { email, status: 'open' },
          email: this.email.prepare({
            recipient: email,
            template: 'supplier_invitation',
            locale,
            title: organization.name,
            sender: context.sroName ?? actor.name,
            deadline: formatExpiry(expiresAt, locale),
            ...(message ? { message } : {}),
            link: `/einladung/${token}`,
          }),
          result: undefined,
        };
      });
      return this.read(tx, organization, relationshipId, context.canInvite);
    });
  }

  revoke(auth: AuthContext, relationshipId: string, invitationId: string): Promise<InvitationList> {
    return this.run(auth, async (tx, organization) => {
      const context = await this.context(tx, auth, organization, relationshipId);
      if (!context.canInvite) throw forbidden();
      const [row] = await tx
        .select({
          email: schema.invitation.email,
          acceptedAt: schema.invitation.acceptedAt,
          revokedAt: schema.invitation.revokedAt,
          expiresAt: schema.invitation.expiresAt,
        })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.id, invitationId),
            eq(schema.invitation.relationshipId, relationshipId),
            eq(schema.invitation.orgId, organization.id),
          ),
        )
        .for('update');
      if (!row) throw notFound();
      const before = statusOf(row);
      if (before !== 'open') {
        throw conflict('invitation_not_open', 'Nur eine offene Einladung lässt sich zurückziehen.');
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, supplierInvitationAudit, async () => {
        await tx
          .update(schema.invitation)
          .set({ revokedAt: new Date() })
          .where(eq(schema.invitation.id, invitationId));
        return {
          objectId: invitationId,
          relationshipId,
          action: 'ended',
          before: { email: row.email, status: before },
          after: { email: row.email, status: 'revoked' },
          result: undefined,
        };
      });
      return this.read(tx, organization, relationshipId, context.canInvite);
    });
  }

  /** Ohne Login: die Einladung, ohne die Daten, die nur die API braucht. */
  async preview(token: string): Promise<PublicInvitation> {
    const row = await this.lookup(token);
    return publicInvitationSchema.parse({
      status: row.status,
      customer: row.customer,
      sro: row.sro,
      supplier: row.supplier,
      kamTaken: row.kam_taken,
    });
  }

  private async lookup(token: string) {
    if (!invitationTokenSchema.safeParse(token).success) throw notFound();
    const row = await this.store.lookup(hashToken(token));
    if (!row) throw notFound();
    return row;
  }

  /**
   * Ohne Login: legt Organisation und Person beim Identitätsanbieter an und übernimmt sie dann in
   * einer Transaktion in Reziproq. Antwortet mit dem Link zur Einrichtung des Passkeys.
   */
  async accept(token: string, input: AcceptInvitationRequest): Promise<AcceptInvitationResponse> {
    const row = await this.lookup(token);
    if (row.status !== 'open') throw unavailable();
    if (input.teamRole === 'sro' && row.kam_taken) throw kamTaken();

    const zitadelOrgId = await this.identity.ensureOrganization({
      supplierOrgId: row.supplier_org_id,
      name: row.supplier,
      existingId: row.zitadel_org_id,
    });
    const user = await this.identity.createUser({
      zitadelOrgId,
      email: row.email,
      name: input.name,
    });
    const givenName = input.name.split(/\s+/u)[0] ?? input.name;
    try {
      await this.store.accept({
        tokenHash: hashToken(token),
        userId: user.userId,
        name: input.name,
        givenName,
        email: row.email,
        zitadelOrgId,
        teamRole: input.teamRole,
        locale: input.locale,
      });
    } catch (error) {
      const message = (error as { cause?: { message?: string } }).cause?.message ?? '';
      const translated = acceptErrors[message];
      if (translated) throw translated();
      throw error;
    }
    return { next: user.passkeySetupUrl };
  }
}
