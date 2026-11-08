import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  objectiveCategoriesResponseSchema,
  objectiveCategoryRequestSchema,
  contributionDetailSchema,
  contributionObjectiveRequestSchema,
  contributionSuggestionsResponseSchema,
  planObjectiveRequestSchema,
  strategicTopicOrderSchema,
  strategicTopicRequestSchema,
  requestContributionsSchema,
  supplierPlanResponseSchema,
  updateObjectiveCategorySchema,
  updatePlanSummarySchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PlanContributionsService } from './plan-contributions.service.js';
import { StrategicTopicsService } from './strategic-topics.service.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const uuid = new ParseUUIDPipe();

@Controller('suppliers/:relationshipId/plan')
export class SupplierPlansController {
  constructor(@Inject(SupplierPlansService) private readonly plans: SupplierPlansService) {}

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
  create(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', uuid) relationshipId: string,
  ) {
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
    return this.topics.create(auth, relationshipId, planId, strategicTopicRequestSchema.parse(body));
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
