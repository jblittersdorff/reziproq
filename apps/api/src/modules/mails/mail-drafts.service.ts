import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, currentTime, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  type MailCommitmentsUpdate,
  type MailCommitmentsView,
  type MailReplyVariant,
  mailCommitmentsViewSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { type MailCommitmentsContent, replyVariant } from './mail-commitments.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const decided = () => new ConflictException({ statusCode: 409, code: 'schon_entschieden' });

type DraftRow = typeof schema.aiDraft.$inferSelect;

/**
 * PO-01 (K2-d.3b): Entwurf „Zusagen aus Mail“ ansehen, anpassen, verwerfen und den Ton der Antwort
 * ändern. Nur die Käuferseite der Beziehung; anpassen und verwerfen darf, wer Zusagen bearbeiten
 * darf (wie ZQ-01). Freigeben und senden kommt mit K2-d.4 (Token, E-K2-15).
 */
@Injectable()
export class MailDraftsService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id, organization };
  }

  private async draftIn(tx: TenantTransaction, organization: AccountOrganization, draftId: string) {
    const [draft] = await tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.id, draftId),
          eq(schema.aiDraft.orgId, organization.id),
          eq(schema.aiDraft.kind, 'commitment_from_mail'),
        ),
      );
    if (!draft?.relationshipId) throw notFound();
    await ownRelationship(tx, organization, draft.relationshipId);
    return draft as DraftRow & { relationshipId: string };
  }

  /** Wie ZQ-01: Recht „massnahmen.bearbeiten“ mit Teamrolle, Admin oder im Team, Beziehung aktiv */
  private async canDecide(tx: TenantTransaction, auth: AuthContext, relationshipId: string) {
    const [relationship] = await tx
      .select({ status: schema.relationship.status })
      .from(schema.relationship)
      .where(eq(schema.relationship.id, relationshipId));
    const [member] = await tx
      .select({ teamRole: schema.relationshipMember.teamRole })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.userId, auth.userId),
        ),
      );
    return (
      relationship?.status !== 'ended' &&
      can(auth, 'massnahmen.bearbeiten', { teamRole: member?.teamRole ?? null }) &&
      (auth.orgRole === 'admin' || member !== undefined)
    );
  }

  private contentOf(draft: DraftRow): MailCommitmentsContent {
    return JSON.parse(draft.content) as MailCommitmentsContent;
  }

  private async viewIn(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: AccountOrganization,
    draft: DraftRow & { relationshipId: string },
  ): Promise<MailCommitmentsView> {
    const content = this.contentOf(draft);
    const [mail] = await tx
      .select()
      .from(schema.filedMail)
      .where(eq(schema.filedMail.id, draft.objectId));
    if (!mail) throw notFound();
    const [summary] = mail.summaryDraftId
      ? await tx
          .select({ content: schema.aiDraft.content, status: schema.aiDraft.status })
          .from(schema.aiDraft)
          .where(eq(schema.aiDraft.id, mail.summaryDraftId))
      : [];
    const [name] = await tx
      .select({
        name: schema.organization.name,
        display: schema.relationshipSide.displayName,
      })
      .from(schema.relationship)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, organization.id),
        ),
      )
      .where(eq(schema.relationship.id, draft.relationshipId));
    return mailCommitmentsViewSchema.parse({
      draftId: draft.id,
      status: draft.status,
      createdAt: draft.createdAt.toISOString(),
      relationship: { id: draft.relationshipId, name: name?.display ?? name?.name ?? '' },
      ownOrganization: organization.name,
      mail: {
        id: mail.id,
        subject: mail.subject,
        fromName: content.sender.name,
        fromEmail: mail.fromEmail,
        sentAt: mail.sentAt.toISOString(),
        summary: summary && summary.status !== 'discarded' ? summary.content : null,
        assignedBy: mail.assignedBy,
      },
      commitments: content.commitments,
      reply: content.reply,
      canDecide: draft.status === 'draft' && (await this.canDecide(tx, auth, draft.relationshipId)),
    });
  }

  view(auth: AuthContext, draftId: string): Promise<MailCommitmentsView> {
    const { userId, organizationId, organization } = this.session(auth);
    return this.tenant.run(
      { userId, organizationId },
      async (tx) =>
        this.viewIn(tx, auth, organization, await this.draftIn(tx, organization, draftId)),
      { readOnly: true },
    );
  }

  /** Zusagen und Antwort ändern; der Entwurf bleibt ein Entwurf, bis jemand freigibt */
  private change(
    auth: AuthContext,
    draftId: string,
    edit: (content: MailCommitmentsContent, signer: string) => MailCommitmentsContent,
  ): Promise<MailCommitmentsView> {
    const { userId, organizationId, organization } = this.session(auth);
    return this.tenant.run({ userId, organizationId }, async (tx) => {
      const draft = await this.draftIn(tx, organization, draftId);
      if (draft.status !== 'draft') throw decided();
      if (!(await this.canDecide(tx, auth, draft.relationshipId))) throw forbidden();
      const [me] = await tx
        .select({ name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, userId));
      const content = edit(this.contentOf(draft), me?.name ?? userId);
      const [saved] = await tx
        .update(schema.aiDraft)
        .set({ content: JSON.stringify(content), edited: true })
        .where(eq(schema.aiDraft.id, draft.id))
        .returning();
      return this.viewIn(tx, auth, organization, {
        ...(saved ?? draft),
        relationshipId: draft.relationshipId,
      });
    });
  }

  update(auth: AuthContext, draftId: string, input: MailCommitmentsUpdate) {
    return this.change(auth, draftId, (content) => ({
      ...content,
      commitments: content.commitments.map((entry, index) => {
        const patch = input.commitments?.find((item) => item.index === index);
        if (!patch) return entry;
        const owner = patch.ownerName ?? entry.ownerName;
        return {
          ...entry,
          title: patch.title ?? entry.title,
          ownerName: owner,
          // Eine andere Person der eigenen Seite bekommt ihre Zusage erst mit Konto (K2-d.4)
          ownerUserId: owner === entry.ownerName ? entry.ownerUserId : null,
          dueOn: patch.dueOn ?? entry.dueOn,
        };
      }),
      reply: input.replyText ? { ...content.reply, text: input.replyText } : content.reply,
    }));
  }

  variant(auth: AuthContext, draftId: string, variant: MailReplyVariant) {
    return this.change(auth, draftId, (content, signer) => ({
      ...content,
      reply: {
        ...content.reply,
        text: replyVariant({
          sender: content.sender.name,
          commitments: content.commitments,
          signer,
          variant,
        }),
      },
    }));
  }

  discard(auth: AuthContext, draftId: string, reason: string): Promise<MailCommitmentsView> {
    const { userId, organizationId, organization } = this.session(auth);
    return this.tenant.run({ userId, organizationId }, async (tx) => {
      const draft = await this.draftIn(tx, organization, draftId);
      if (draft.status !== 'draft') throw decided();
      if (!(await this.canDecide(tx, auth, draft.relationshipId))) throw forbidden();
      const [saved] = await tx
        .update(schema.aiDraft)
        .set({
          status: 'discarded',
          dismissReason: reason,
          decidedBy: userId,
          decidedAt: currentTime(),
        })
        .where(eq(schema.aiDraft.id, draft.id))
        .returning();
      return this.viewIn(tx, auth, organization, {
        ...(saved ?? draft),
        relationshipId: draft.relationshipId,
      });
    });
  }
}
