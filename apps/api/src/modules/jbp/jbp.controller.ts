import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type CreateJbp,
  createJbpSchema,
  type ImportJbpTopics,
  type InitiativeDetail,
  type Initiatives,
  importJbpTopicsSchema,
  initiativeStatusSchema,
  type JbpPreparation,
  type JbpTopicCandidates,
  type JbpTopicOrder,
  type JbpTopics,
  jbpTopicOrderSchema,
  type ParkJbpTopic,
  parkJbpTopicSchema,
  type SaveBusinessUpdate,
  type SaveInitiative,
  type SaveJbpTopic,
  type SaveMilestone,
  type SetInitiativeStatus,
  saveBusinessUpdateSchema,
  saveInitiativeSchema,
  saveJbpTopicSchema,
  saveMilestoneSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { type JbpScope, JbpService } from './jbp.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan beim Käufer (JBP-01). */
@Controller('suppliers/:id/jbp')
export class BuyerJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Post()
  @Requires('jbp.anlegen')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createJbpSchema)) body: CreateJbp,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.create(scope, body));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}

/** Gemeinsamer Plan beim Lieferanten im Kontext des Kunden (JBP-01). */
@Controller('kunden/:id/jbp')
export class SupplierJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}

type Side = 'buyer' | 'supplier';

/** JBP-02: Themen beider Seiten; dieselben Endpunkte je Seite. */
function topicRoutes(side: Side) {
  class SideTopicsController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpTopicsService) readonly topics: JbpTopicsService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.topics(scope));
    }

    @Post()
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveJbpTopicSchema)) body: SaveJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.create(scope, body));
    }

    @Put('reihenfolge')
    @Requires('jbp.bearbeiten')
    reorder(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(jbpTopicOrderSchema)) body: JbpTopicOrder,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.reorder(scope, body.ids));
    }

    @Put(':topicId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
      @Body(new ZodValidationPipe(saveJbpTopicSchema)) body: SaveJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.update(scope, topicId, body));
    }

    @Put(':topicId/parken')
    @Requires('jbp.bearbeiten')
    park(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
      @Body(new ZodValidationPipe(parkJbpTopicSchema)) body: ParkJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.park(scope, topicId, body.reason));
    }

    @Put(':topicId/wieder-aufnehmen')
    @Requires('jbp.bearbeiten')
    restore(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.restore(scope, topicId));
    }
  }
  return SideTopicsController;
}

/** Themen beim Käufer (JBP-02), dazu die Übernahme aus dem Lieferantenplan. */
@Controller('suppliers/:id/jbp/themen')
export class BuyerJbpTopicsController extends topicRoutes('buyer') {
  @Get('vorschlaege')
  @Requires('jbp.anlegen')
  candidates(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpTopicCandidates> {
    return this.jbp.buyer(auth, id, (scope) => this.topics.candidates(scope));
  }

  @Post('uebernehmen')
  @Requires('jbp.anlegen')
  importTopics(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(importJbpTopicsSchema)) body: ImportJbpTopics,
  ): Promise<JbpTopics> {
    return this.jbp.buyer(auth, id, (scope) => this.topics.importTopics(scope, body));
  }
}

/** Themen beim Lieferanten im Kontext des Kunden (JBP-02, LIF-04). */
@Controller('kunden/:id/jbp/themen')
export class SupplierJbpTopicsController extends topicRoutes('supplier') {}

/** JBP-03: Initiativen und Roadmap; dieselben Endpunkte je Seite. */
function initiativeRoutes(side: Side) {
  class SideInitiativesController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpInitiativesService) readonly initiatives: JbpInitiativesService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Initiatives> {
      return this.run(auth, id, (scope) => this.initiatives.list(scope));
    }

    @Post()
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveInitiativeSchema)) body: SaveInitiative,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.create(scope, body));
    }

    @Get(':initiativeId')
    @Requires('jbp.sehen')
    get(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.get(scope, initiativeId));
    }

    @Put(':initiativeId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(saveInitiativeSchema)) body: SaveInitiative,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.update(scope, initiativeId, body));
    }

    @Put(':initiativeId/status')
    @Requires('jbp.bearbeiten')
    status(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(initiativeStatusSchema)) body: SetInitiativeStatus,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.setStatus(scope, initiativeId, body.status),
      );
    }

    @Post(':initiativeId/meilensteine')
    @Requires('jbp.bearbeiten')
    addMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(saveMilestoneSchema)) body: SaveMilestone,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.addMilestone(scope, initiativeId, body),
      );
    }

    @Put(':initiativeId/meilensteine/:milestoneId')
    @Requires('jbp.bearbeiten')
    updateMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
      @Body(new ZodValidationPipe(saveMilestoneSchema)) body: SaveMilestone,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.updateMilestone(scope, initiativeId, milestoneId, body),
      );
    }

    @Delete(':initiativeId/meilensteine/:milestoneId')
    @Requires('jbp.bearbeiten')
    deleteMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.deleteMilestone(scope, initiativeId, milestoneId),
      );
    }
  }
  return SideInitiativesController;
}

/** Initiativen beim Käufer (JBP-03). */
@Controller('suppliers/:id/jbp/initiativen')
export class BuyerJbpInitiativesController extends initiativeRoutes('buyer') {}

/** Initiativen beim Lieferanten im Kontext des Kunden (JBP-03). */
@Controller('kunden/:id/jbp/initiativen')
export class SupplierJbpInitiativesController extends initiativeRoutes('supplier') {}
