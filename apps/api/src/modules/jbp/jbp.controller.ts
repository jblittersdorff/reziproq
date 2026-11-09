import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type CreateJbp,
  createJbpSchema,
  type ImportJbpTopics,
  importJbpTopicsSchema,
  type JbpPreparation,
  type JbpTopicCandidates,
  type JbpTopicOrder,
  type JbpTopics,
  jbpTopicOrderSchema,
  type ParkJbpTopic,
  parkJbpTopicSchema,
  type SaveBusinessUpdate,
  type SaveJbpTopic,
  saveBusinessUpdateSchema,
  saveJbpTopicSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { type JbpScope, JbpService } from './jbp.service.js';
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
