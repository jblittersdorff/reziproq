import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  eq,
  schema,
  seedMaterialGroupDefaults,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type CustomLeverRequest,
  customLeverRequestSchema,
  defaultObjectiveCategories,
  goalDimensions,
  isInternalSwot,
  type LeverChoiceRequest,
  leverChoiceRequestSchema,
  type StrategyAssessment,
  type StrategyLeverUpdate,
  type SwotRequest,
  strategyAssessmentSchema,
  strategyLeverSchema,
  swotCodePrefix,
  swotRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { StrategyService } from './strategy.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalidPairing = () =>
  new BadRequestException({
    code: 'invalid_pairing',
    message: 'Eine Paarung verbindet eine Stärke oder Schwäche mit einer Chance oder einem Risiko.',
  });

const step = 6;

/**
 * WG-10: Bewertung und Hebel (Schritt 6). Profil mit fortlaufenden Kürzeln je Typ, Paarungen aus
 * genau einem internen und einem externen Eintrag, Hebel aus dem Katalog des Kunden. Ein gewählter
 * Hebel braucht eine Begründung; Vorschläge zählen nicht für „Fertig, wenn“.
 */
@Injectable()
export class AssessmentService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StrategyService) private readonly strategies: StrategyService,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  private async editable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  get(auth: AuthContext, strategyId: string): Promise<StrategyAssessment> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      return this.view(tx, organization.id, strategyId, access.editableSteps.includes(step));
    });
  }

  private async view(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    canEdit: boolean,
  ): Promise<StrategyAssessment> {
    await seedMaterialGroupDefaults(tx, orgId);
    const items = await tx
      .select()
      .from(schema.materialGroupSwotItem)
      .where(eq(schema.materialGroupSwotItem.strategyId, strategyId))
      .orderBy(asc(schema.materialGroupSwotItem.createdAt));
    const choices = await tx
      .select()
      .from(schema.materialGroupLeverChoice)
      .where(eq(schema.materialGroupLeverChoice.strategyId, strategyId))
      .orderBy(asc(schema.materialGroupLeverChoice.createdAt));
    const used = new Set(choices.map((choice) => choice.leverId));
    const levers = (
      await tx.select().from(schema.strategyLever).orderBy(asc(schema.strategyLever.createdAt))
    ).filter((entry) => entry.active || used.has(entry.id));
    const categories = await tx
      .select({ key: schema.objectiveCategory.key, name: schema.objectiveCategory.name })
      .from(schema.objectiveCategory)
      .where(eq(schema.objectiveCategory.orgId, orgId));
    return strategyAssessmentSchema.parse({
      canEdit,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        code: item.code,
        text: item.text,
        originStep: item.originStep,
        originView: item.originView,
        status: item.status,
      })),
      choices: choices.map((choice) => ({
        id: choice.id,
        internalItemId: choice.internalItemId,
        externalItemId: choice.externalItemId,
        leverId: choice.leverId,
        reason: choice.reason,
        status: choice.status,
      })),
      levers: levers.map((entry) => strategyLeverSchema.parse(entry)),
      dimensions: goalDimensions.map((key) => ({
        key,
        name:
          categories.find((category) => category.key === key)?.name ??
          defaultObjectiveCategories.find((category) => category.key === key)?.name ??
          key,
      })),
    });
  }

  addItem(auth: AuthContext, strategyId: string, input: SwotRequest): Promise<StrategyAssessment> {
    const item = swotRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const prefix = swotCodePrefix[item.type];
      // Kürzel je Typ fortlaufend; gelöschte Nummern werden nicht wieder vergeben.
      const [last] = await tx
        .select({
          n: sql<number>`coalesce(max(substring(${schema.materialGroupSwotItem.code} from 2)::int), 0)::int`,
        })
        .from(schema.materialGroupSwotItem)
        .where(
          and(
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
            eq(schema.materialGroupSwotItem.type, item.type),
          ),
        );
      await tx.insert(schema.materialGroupSwotItem).values({
        orgId: organization.id,
        strategyId,
        type: item.type,
        code: `${prefix}${(last?.n ?? 0) + 1}`,
        text: item.text,
        originStep: item.originStep,
        originView: item.originView,
        status: 'confirmed',
      });
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  updateItem(
    auth: AuthContext,
    strategyId: string,
    itemId: string,
    change: { text?: string | undefined; confirm?: boolean | undefined },
  ): Promise<StrategyAssessment> {
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const text = change.text?.trim();
      if (change.text !== undefined && !text) {
        throw new BadRequestException({ code: 'text_required', message: 'Ungültige Eingabe' });
      }
      const rows = await tx
        .update(schema.materialGroupSwotItem)
        .set({
          ...(text ? { text } : {}),
          ...(change.confirm ? { status: 'confirmed' as const } : {}),
        })
        .where(
          and(
            eq(schema.materialGroupSwotItem.id, itemId),
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupSwotItem.id });
      if (!rows.length) throw notFound();
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  removeItem(auth: AuthContext, strategyId: string, itemId: string): Promise<StrategyAssessment> {
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const rows = await tx
        .delete(schema.materialGroupSwotItem)
        .where(
          and(
            eq(schema.materialGroupSwotItem.id, itemId),
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupSwotItem.id });
      if (!rows.length) throw notFound();
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  /** Prüft die Paarung: genau ein interner und ein externer Eintrag dieser Strategie, eigener Hebel. */
  private async checkPairing(
    tx: TenantTransaction,
    strategyId: string,
    choice: { internalItemId: string; externalItemId: string; leverId: string },
  ) {
    const item = async (id: string) => {
      const [row] = await tx
        .select({ type: schema.materialGroupSwotItem.type })
        .from(schema.materialGroupSwotItem)
        .where(
          and(
            eq(schema.materialGroupSwotItem.id, id),
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
          ),
        );
      return row?.type ?? null;
    };
    const internal = await item(choice.internalItemId);
    const external = await item(choice.externalItemId);
    if (!internal || !external || !isInternalSwot(internal) || isInternalSwot(external)) {
      throw invalidPairing();
    }
    const [found] = await tx
      .select({ id: schema.strategyLever.id })
      .from(schema.strategyLever)
      .where(eq(schema.strategyLever.id, choice.leverId));
    if (!found)
      throw new BadRequestException({ code: 'lever_unknown', message: 'Ungültige Eingabe' });
  }

  addChoice(
    auth: AuthContext,
    strategyId: string,
    input: LeverChoiceRequest,
  ): Promise<StrategyAssessment> {
    const choice = leverChoiceRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      await this.checkPairing(tx, strategyId, choice);
      await tx.insert(schema.materialGroupLeverChoice).values({
        orgId: organization.id,
        strategyId,
        ...choice,
      });
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  updateChoice(
    auth: AuthContext,
    strategyId: string,
    choiceId: string,
    input: LeverChoiceRequest,
  ): Promise<StrategyAssessment> {
    const choice = leverChoiceRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      await this.checkPairing(tx, strategyId, choice);
      const rows = await tx
        .update(schema.materialGroupLeverChoice)
        .set(choice)
        .where(
          and(
            eq(schema.materialGroupLeverChoice.id, choiceId),
            eq(schema.materialGroupLeverChoice.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupLeverChoice.id });
      if (!rows.length) throw notFound();
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  removeChoice(
    auth: AuthContext,
    strategyId: string,
    choiceId: string,
  ): Promise<StrategyAssessment> {
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const rows = await tx
        .delete(schema.materialGroupLeverChoice)
        .where(
          and(
            eq(schema.materialGroupLeverChoice.id, choiceId),
            eq(schema.materialGroupLeverChoice.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupLeverChoice.id });
      if (!rows.length) throw notFound();
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, organization.id, strategyId, true);
    });
  }

  /** Hebelkatalog des Kunden; Inaktive nur für die Pflege. */
  levers(auth: AuthContext) {
    return this.run(auth, async (tx, organization) => {
      await seedMaterialGroupDefaults(tx, organization.id);
      const rows = await tx
        .select()
        .from(schema.strategyLever)
        .orderBy(asc(schema.strategyLever.createdAt));
      return { levers: rows.map((row) => strategyLeverSchema.parse(row)) };
    });
  }

  /** Eigener Hebel mit Begründung, landet als custom im Katalog des Kunden. */
  addCustomLever(auth: AuthContext, input: CustomLeverRequest) {
    const request = customLeverRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      await seedMaterialGroupDefaults(tx, organization.id);
      const [row] = await tx
        .insert(schema.strategyLever)
        .values({ orgId: organization.id, ...request, custom: true })
        .returning()
        .catch((error: { cause?: { code?: string } }) => {
          if (error.cause?.code === '23505') {
            throw new ConflictException({ statusCode: 409, code: 'lever_exists' });
          }
          throw error;
        });
      return strategyLeverSchema.parse(row);
    });
  }

  updateLever(auth: AuthContext, id: string, change: StrategyLeverUpdate) {
    return this.run(auth, async (tx) => {
      const rows = await tx
        .update(schema.strategyLever)
        .set(change)
        .where(eq(schema.strategyLever.id, id))
        .returning();
      const [row] = rows;
      if (!row) throw notFound();
      return strategyLeverSchema.parse(row);
    });
  }
}
