import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  contributionDetailSchema,
  contributionObjectiveRequestSchema,
  contributionSuggestionsResponseSchema,
  objectiveCategoriesResponseSchema,
  objectiveCategoryRequestSchema,
  type PlanDecision,
  planDecisionSchema,
  planObjectiveRequestSchema,
  requestContributionsSchema,
  strategicTopicOrderSchema,
  strategicTopicRequestSchema,
  supplierPlanResponseSchema,
  updateObjectiveCategorySchema,
  updatePlanSummarySchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PlanApprovalsService } from './plan-approvals.service.js';
import { PlanContributionsService } from './plan-contributions.service.js';
import { PlanSummaryDraftService } from './plan-summary-draft.service.js';
import { StrategicTopicsService } from './strategic-topics.service.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const uuid = new ParseUUIDPipe();

@Controller('suppliers/:relationshipId/plan')
export class SupplierPlansController {
  constructor(
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
    @Inject(PlanSummaryDraftService) private readonly summaryDrafts: PlanSummaryDraftService,
  ) {}

  @Get()
  @Requires('lieferanten.sehen')
  async get(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
  ) {
    return supplierPlanResponseSchema.parse(await this.plans.get(auth, relationshipId));
  }

  @Post()
  @Requires('lieferantenplan.bearbeiten')
  create(@CurrentUser() auth: AuthContext, @Param('relationshipId', uuid) relationshipId: string) {
    return this.plans.create(auth, relationshipId);
  }

  @Patch(':planId/summary')
  @Requires('lieferantenplan.bearbeiten')
  updateSummary(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(updatePlanSummarySchema)) body: unknown,
  ) {
    return this.plans.updateSummary(
      auth,
      relationshipId,
      planId,
      updatePlanSummarySchema.parse(body),
    );
  }

  // SPL-10: KI-Entwurf der Strategie-Zusammenfassung; Teil des Plans erst mit PATCH summary.
  @Get(':planId/summary/draft')
  @Requires('lieferantenplan.bearbeiten')
  summaryDraft(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
  ) {
    return this.summaryDrafts.get(auth, relationshipId, planId);
  }

  @Post(':planId/summary/draft')
  @HttpCode(200)
  @Requires('lieferantenplan.bearbeiten')
  proposeSummary(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
  ) {
    return this.summaryDrafts.propose(auth, relationshipId, planId);
  }

  @Post(':planId/summary/draft/:draftId/accept')
  @HttpCode(200)
  @Requires('lieferantenplan.bearbeiten')
  acceptSummaryDraft(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Param('draftId', uuid) draftId: string,
  ) {
    return this.summaryDrafts.decide(auth, relationshipId, planId, draftId, 'accepted');
  }

  @Post(':planId/summary/draft/:draftId/discard')
  @HttpCode(200)
  @Requires('lieferantenplan.bearbeiten')
  discardSummaryDraft(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Param('draftId', uuid) draftId: string,
  ) {
    return this.summaryDrafts.decide(auth, relationshipId, planId, draftId, 'discarded');
  }

  @Post(':planId/objectives')
  @Requires('lieferantenplan.bearbeiten')
  createObjective(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(planObjectiveRequestSchema)) body: unknown,
  ) {
    return this.plans.createObjective(
      auth,
      relationshipId,
      planId,
      planObjectiveRequestSchema.parse(body),
    );
  }

  @Patch(':planId/objectives/:objectiveId')
  @Requires('lieferantenplan.bearbeiten')
  updateObjective(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Param('objectiveId', uuid) objectiveId: string,
    @Body(new ZodValidationPipe(planObjectiveRequestSchema)) body: unknown,
  ) {
    return this.plans.updateObjective(
      auth,
      relationshipId,
      planId,
      objectiveId,
      planObjectiveRequestSchema.parse(body),
    );
  }
}

@Controller('suppliers/:relationshipId/plan')
export class PlanContributionsController {
  constructor(
    @Inject(PlanContributionsService) private readonly contributions: PlanContributionsService,
  ) {}

  @Get(':planId/contribution-suggestions')
  @Requires('lieferantenplan.bearbeiten')
  async suggestions(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
  ) {
    return contributionSuggestionsResponseSchema.parse(
      await this.contributions.suggestions(auth, relationshipId, planId),
    );
  }

  @Post(':planId/contributions')
  @Requires('lieferantenplan.bearbeiten')
  request(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(requestContributionsSchema)) body: unknown,
  ) {
    return this.contributions.request(
      auth,
      relationshipId,
      planId,
      requestContributionsSchema.parse(body),
    );
  }

  @Get('contributions/:contributionId')
  @Requires('lieferanten.sehen')
  async get(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('contributionId', uuid) contributionId: string,
  ) {
    return contributionDetailSchema.parse(
      await this.contributions.get(auth, relationshipId, contributionId),
    );
  }

  @Post('contributions/:contributionId/objectives')
  @Requires('lieferanten.sehen')
  createObjective(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('contributionId', uuid) contributionId: string,
    @Body(new ZodValidationPipe(contributionObjectiveRequestSchema)) body: unknown,
  ) {
    return this.contributions.createObjective(
      auth,
      relationshipId,
      contributionId,
      contributionObjectiveRequestSchema.parse(body),
    );
  }

  @Post('contributions/:contributionId/complete')
  @Requires('lieferanten.sehen')
  complete(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('contributionId', uuid) contributionId: string,
  ) {
    return this.contributions.complete(auth, relationshipId, contributionId);
  }
}

@Controller('suppliers/:relationshipId/plan/:planId')
export class StrategicTopicsController {
  constructor(@Inject(StrategicTopicsService) private readonly topics: StrategicTopicsService) {}

  @Post('topics')
  @Requires('lieferantenplan.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(strategicTopicRequestSchema)) body: unknown,
  ) {
    return this.topics.create(
      auth,
      relationshipId,
      planId,
      strategicTopicRequestSchema.parse(body),
    );
  }

  @Put('topic-order')
  @Requires('lieferantenplan.bearbeiten')
  reorder(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(strategicTopicOrderSchema)) body: unknown,
  ) {
    return this.topics.reorder(auth, relationshipId, planId, strategicTopicOrderSchema.parse(body));
  }

  @Put('topics/:topicId')
  @Requires('lieferantenplan.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Param('topicId', uuid) topicId: string,
    @Body(new ZodValidationPipe(strategicTopicRequestSchema)) body: unknown,
  ) {
    return this.topics.update(
      auth,
      relationshipId,
      planId,
      topicId,
      strategicTopicRequestSchema.parse(body),
    );
  }
}

@Controller('objective-categories')
export class ObjectiveCategoriesController {
  constructor(@Inject(SupplierPlansService) private readonly plans: SupplierPlansService) {}

  @Get()
  @Requires('lieferanten.sehen')
  async list(@CurrentUser() auth: AuthContext) {
    return objectiveCategoriesResponseSchema.parse(await this.plans.listCategories(auth));
  }

  @Post()
  @Requires('stammdaten.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(objectiveCategoryRequestSchema)) body: unknown,
  ) {
    return this.plans.createCategory(auth, objectiveCategoryRequestSchema.parse(body));
  }

  @Patch(':key')
  @Requires('stammdaten.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateObjectiveCategorySchema)) body: unknown,
  ) {
    return this.plans.updateCategory(auth, key, updateObjectiveCategorySchema.parse(body));
  }
}

/** SPL-07: Freigabe und Versionen des Lieferantenplans (käuferintern). */
@Controller('suppliers/:relationshipId/plan')
export class PlanApprovalsController {
  constructor(@Inject(PlanApprovalsService) private readonly approvals: PlanApprovalsService) {}

  @Get('versions')
  @Requires('lieferanten.sehen')
  versions(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
  ) {
    return this.approvals.versions(auth, relationshipId);
  }

  @Post(':planId/submit')
  @Requires('lieferantenplan.bearbeiten')
  submit(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
  ) {
    return this.approvals.submit(auth, relationshipId, planId);
  }

  @Post(':planId/decision')
  @Requires('lieferantenplan.bearbeiten')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
    @Body(new ZodValidationPipe(planDecisionSchema)) body: PlanDecision,
  ) {
    return this.approvals.decide(auth, relationshipId, planId, body);
  }

  @Post(':planId/new-version')
  @Requires('lieferantenplan.bearbeiten')
  newVersion(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
    @Param('planId', uuid) planId: string,
  ) {
    return this.approvals.newVersion(auth, relationshipId, planId);
  }
}
