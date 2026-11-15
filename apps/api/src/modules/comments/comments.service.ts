import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  eq,
  inArray,
  isNull,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type Comment,
  type CommentList,
  type CommentObjectType,
  type CommentPerson,
  commentEditHours,
  commentListSchema,
  type DueItem,
  type EditComment,
  type MeetingSide,
  type SaveComment,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ActionsService } from '../actions/actions.service.js';
import { actorOf } from '../audit/actor.js';
import { commentAudit, commentInternalAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';

const forbidden = (code = 'keine_berechtigung') =>
  new ForbiddenException({ statusCode: 403, code });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const badRequest = (code: string) => new BadRequestException({ statusCode: 400, code });

/** Wo kommentiert wird: Seite, eigene Organisation, Käufer der Beziehung, ob geschrieben werden darf. */
export interface CommentScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: MeetingSide;
  orgId: string;
  buyerOrgId: string;
  relationshipId: string;
  canComment: boolean;
}

type CommentRow = typeof schema.comment.$inferSelect;

/** Adresse des Objekts unter /lieferanten/<id> bzw. /kunden/<id> */
export function commentObjectPath(type: CommentObjectType, objectId: string): string {
  switch (type) {
    case 'initiative':
      return `/plan/initiativen/${objectId}`;
    case 'commitment':
      return `/plan/zusagen/${objectId}`;
    case 'topic':
      return `/plan/themen/${objectId}`;
    case 'action':
      return `/umsetzung/massnahmen/${objectId}`;
    case 'meeting':
      return `/umsetzung/termine/${objectId}`;
    case 'rule_set':
      return '/beziehung/spielregeln';
  }
}

/**
 * QS-02: Kommentare beider Seiten an Initiativen, Zusagen, Maßnahmen, Terminen, Themen und
 * Spielregeln. Wer das Objekt sieht, kommentiert; RLS hält interne Kommentare der anderen Seite
 * fern (PLT-04). Erwähnungen, ihre Mail ohne Kommentartext und der Eintrag auf Start laufen über
 * die Funktion app_kommentar_erwaehnen.
 */
@Injectable()
export class CommentsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Inject(ActionsService) private readonly actions: ActionsService,
  ) {}

  /** Käuferseite: eigene Beziehung; in einer beendeten Beziehung nur lesen. */
  buyer<T>(auth: AuthContext, relationshipId: string, work: (scope: CommentScope) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
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
      return work({
        tx,
        auth,
        side: 'buyer',
        orgId: organization.id,
        buyerOrgId: organization.id,
        relationshipId,
        canComment: relationship.status !== 'ended' && can(auth, 'kommentare.schreiben'),
      });
    });
  }

  /** Lieferantenseite: im Kontext genau dieses Kunden (LIF-02). */
  supplier<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (scope: CommentScope) => Promise<T>,
  ) {
    return this.customers.inCustomer(auth, relationshipId, (tx, customer) =>
      work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        buyerOrgId: customer.buyerOrgId,
        relationshipId,
        canComment: can(auth, 'kommentare.schreiben'),
      }),
    );
  }

  /** Das Objekt, so wie RLS es der eigenen Seite zeigt; sonst 404. */
  private async object(scope: CommentScope, type: CommentObjectType, objectId: string) {
    const { tx, relationshipId } = scope;
    const pick = async (
      table:
        | typeof schema.initiative
        | typeof schema.commitment
        | typeof schema.action
        | typeof schema.meeting
        | typeof schema.jbpTopic,
    ) => {
      const [row] = await tx
        .select({ visibility: table.visibility, title: table.title })
        .from(table)
        .where(and(eq(table.id, objectId), eq(table.relationshipId, relationshipId)));
      return row;
    };
    let found: { visibility: 'internal' | 'shared'; title: string } | undefined;
    if (type === 'initiative') found = await pick(schema.initiative);
    else if (type === 'commitment') found = await pick(schema.commitment);
    else if (type === 'action') found = await pick(schema.action);
    else if (type === 'meeting') found = await pick(schema.meeting);
    else if (type === 'topic') found = await pick(schema.jbpTopic);
    else {
      const [row] = await tx
        .select({ visibility: schema.ruleSet.visibility, version: schema.ruleSet.version })
        .from(schema.ruleSet)
        .where(
          and(eq(schema.ruleSet.id, objectId), eq(schema.ruleSet.relationshipId, relationshipId)),
        );
      found = row && { visibility: row.visibility, title: `Spielregeln ${row.version}` };
    }
    if (!found) throw notFound();
    return found;
  }

  /**
   * Wen man erwähnen darf: intern die eigene Seite im Team, geteilt zusätzlich die geteilten
   * Teammitglieder der anderen Seite. Wer gerade schreibt, steht nicht in der Liste.
   */
  private async people(scope: CommentScope) {
    const members = await scope.tx
      .select({
        userId: schema.relationshipMember.userId,
        orgId: schema.relationshipMember.orgId,
        visibility: schema.relationshipMember.visibility,
        memberName: schema.relationshipMember.memberName,
        userName: schema.appUser.name,
      })
      .from(schema.relationshipMember)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(eq(schema.relationshipMember.relationshipId, scope.relationshipId))
      .orderBy(asc(schema.relationshipMember.memberName));
    const otherSide: MeetingSide = scope.side === 'buyer' ? 'supplier' : 'buyer';
    const internal: CommentPerson[] = [];
    const shared: CommentPerson[] = [];
    // Namen für Erwähnungen in Kommentaren, auch die eigene Person
    const names = new Map<string, CommentPerson>();
    for (const member of members) {
      const own = member.orgId === scope.orgId;
      const name = member.userName ?? member.memberName;
      if (!name) continue;
      if (own || member.visibility === 'shared') {
        names.set(member.userId, {
          userId: member.userId,
          name,
          side: own ? scope.side : otherSide,
        });
      }
      if (member.userId === scope.auth.userId) continue;
      if (own) {
        const person = { userId: member.userId, name, side: scope.side };
        internal.push(person);
        shared.push(person);
      } else if (member.visibility === 'shared') {
        shared.push({ userId: member.userId, name, side: otherSide });
      }
    }
    const byName = (a: CommentPerson, b: CommentPerson) => a.name.localeCompare(b.name);
    return { internal: internal.sort(byName), shared: shared.sort(byName), names };
  }

  private toComment(
    scope: CommentScope,
    row: CommentRow,
    names: Map<string, CommentPerson>,
    now: Date,
  ): Comment {
    const own = row.authorId === scope.auth.userId;
    const deleted = row.deletedAt !== null;
    const fresh = now.getTime() - row.createdAt.getTime() < commentEditHours * 60 * 60 * 1000;
    return {
      id: row.id,
      side: row.ownerOrgId === scope.buyerOrgId ? 'buyer' : 'supplier',
      visibility: row.visibility,
      authorName: row.authorName,
      own,
      body: deleted ? null : row.body,
      mentions: deleted
        ? []
        : row.mentions.flatMap((userId) => {
            const person = names.get(userId);
            return person ? [person] : [];
          }),
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      canEdit: scope.canComment && own && !deleted && fresh,
      canDelete: scope.canComment && own && !deleted,
    };
  }

  async list(
    scope: CommentScope,
    type: CommentObjectType,
    objectId: string,
    now = new Date(),
  ): Promise<CommentList> {
    const object = await this.object(scope, type, objectId);
    const rows = await scope.tx
      .select()
      .from(schema.comment)
      .where(
        and(
          eq(schema.comment.relationshipId, scope.relationshipId),
          eq(schema.comment.objectType, type),
          eq(schema.comment.objectId, objectId),
        ),
      )
      .orderBy(asc(schema.comment.createdAt));
    const { names, ...people } = await this.people(scope);
    // Wer die Kommentare sieht, hat seine Erwähnungen geöffnet: Sie verschwinden von Start.
    if (rows.length > 0) {
      await scope.tx
        .update(schema.commentMention)
        .set({ openedAt: now })
        .where(
          and(
            eq(schema.commentMention.userId, scope.auth.userId),
            isNull(schema.commentMention.openedAt),
            inArray(
              schema.commentMention.commentId,
              rows.map((row) => row.id),
            ),
          ),
        );
    }
    return commentListSchema.parse({
      comments: rows.map((row) => this.toComment(scope, row, names, now)),
      canComment: scope.canComment,
      objectVisibility: object.visibility,
      people,
    });
  }

  async create(
    scope: CommentScope,
    type: CommentObjectType,
    objectId: string,
    input: SaveComment,
  ): Promise<CommentList> {
    if (!scope.canComment) throw forbidden();
    const object = await this.object(scope, type, objectId);
    // Kommentare an internen Objekten bleiben intern.
    if (object.visibility === 'internal' && input.visibility === 'shared') {
      throw badRequest('objekt_intern');
    }
    const people = await this.people(scope);
    const allowed = new Set(
      (input.visibility === 'internal' ? people.internal : people.shared).map(
        (person) => person.userId,
      ),
    );
    const mentions = [...new Set(input.mentions)];
    if (mentions.some((userId) => !allowed.has(userId))) {
      throw badRequest('erwaehnung_nicht_erlaubt');
    }
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    const audit = input.visibility === 'internal' ? commentInternalAudit : commentAudit;
    const created = await auditedChange(scope.tx, actor, audit, async () => {
      const [row] = await scope.tx
        .insert(schema.comment)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: input.visibility,
          objectType: type,
          objectId,
          authorId: scope.auth.userId,
          authorName: actor.name,
          body: input.body,
          mentions,
        })
        .returning();
      if (!row) throw new Error('Kommentar nicht angelegt');
      return {
        relationshipId: scope.relationshipId,
        objectId: row.id,
        action: 'created' as const,
        before: null,
        after: { visibility: row.visibility },
        result: row,
      };
    });
    const path = commentObjectPath(type, objectId);
    const title = object.title.slice(0, 200);
    for (const userId of mentions) {
      await scope.tx.execute(
        sql`select app_kommentar_erwaehnen(${created.id}::uuid, ${userId}, ${title},
          ${`/lieferanten/${scope.relationshipId}${path}`},
          ${`/kunden/${scope.relationshipId}${path}`})`,
      );
    }
    return this.list(scope, type, objectId);
  }

  private async own(scope: CommentScope, type: CommentObjectType, objectId: string, id: string) {
    if (!scope.canComment) throw forbidden();
    await this.object(scope, type, objectId);
    const [row] = await scope.tx
      .select()
      .from(schema.comment)
      .where(
        and(
          eq(schema.comment.id, id),
          eq(schema.comment.relationshipId, scope.relationshipId),
          eq(schema.comment.objectType, type),
          eq(schema.comment.objectId, objectId),
        ),
      );
    if (!row) throw notFound();
    if (row.authorId !== scope.auth.userId || row.ownerOrgId !== scope.orgId) throw forbidden();
    if (row.deletedAt) throw badRequest('kommentar_entfernt');
    return row;
  }

  /** Bearbeiten: nur der Verfasser, 24 Stunden lang. */
  async edit(
    scope: CommentScope,
    type: CommentObjectType,
    objectId: string,
    id: string,
    input: EditComment,
    now = new Date(),
  ): Promise<CommentList> {
    const row = await this.own(scope, type, objectId, id);
    if (now.getTime() - row.createdAt.getTime() >= commentEditHours * 60 * 60 * 1000) {
      throw forbidden('bearbeiten_abgelaufen');
    }
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    const audit = row.visibility === 'internal' ? commentInternalAudit : commentAudit;
    await auditedChange(scope.tx, actor, audit, async () => {
      await scope.tx
        .update(schema.comment)
        .set({ body: input.body, editedAt: now })
        .where(eq(schema.comment.id, row.id));
      return {
        relationshipId: scope.relationshipId,
        objectId: row.id,
        action: 'updated' as const,
        before: { edited_at: row.editedAt?.toISOString() ?? null },
        after: { edited_at: now.toISOString() },
        result: null,
      };
    });
    return this.list(scope, type, objectId, now);
  }

  /** Entfernen: nur der Verfasser; der Kommentar bleibt als „Kommentar entfernt“ im Verlauf. */
  async remove(
    scope: CommentScope,
    type: CommentObjectType,
    objectId: string,
    id: string,
  ): Promise<CommentList> {
    const row = await this.own(scope, type, objectId, id);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    const audit = row.visibility === 'internal' ? commentInternalAudit : commentAudit;
    const now = new Date();
    await auditedChange(scope.tx, actor, audit, async () => {
      await scope.tx
        .update(schema.comment)
        .set({ body: '', deletedAt: now })
        .where(eq(schema.comment.id, row.id));
      return {
        relationshipId: scope.relationshipId,
        objectId: row.id,
        action: 'updated' as const,
        before: { deleted_at: null },
        after: { deleted_at: now.toISOString() },
        result: null,
      };
    });
    return this.list(scope, type, objectId, now);
  }

  /** Aufgaben-Quelle für Start: Erwähnungen, die die Person noch nicht geöffnet hat. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!can(auth, 'kommentare.schreiben')) return [];
    const items: DueItem[] = [];
    await this.actions.eachRelationship(
      auth,
      async (tx, entry) => {
        const rows = await tx
          .select({
            id: schema.commentMention.id,
            createdAt: schema.commentMention.createdAt,
            objectType: schema.comment.objectType,
            objectId: schema.comment.objectId,
            authorName: schema.comment.authorName,
          })
          .from(schema.commentMention)
          .innerJoin(schema.comment, eq(schema.comment.id, schema.commentMention.commentId))
          .where(
            and(
              eq(schema.commentMention.relationshipId, entry.relationshipId),
              eq(schema.commentMention.userId, auth.userId),
              isNull(schema.commentMention.openedAt),
              isNull(schema.comment.deletedAt),
            ),
          );
        for (const row of rows) {
          items.push({
            id: row.id,
            kind: 'mention',
            supplier: entry.counterpart,
            detail: row.authorName,
            dueDate: row.createdAt.toISOString().slice(0, 10),
            href: `${entry.base}${commentObjectPath(row.objectType, row.objectId)}`,
          });
        }
      },
      'kommentare.schreiben',
    );
    return items;
  }
}
