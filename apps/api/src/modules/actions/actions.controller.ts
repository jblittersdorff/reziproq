import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type ActionItem,
  type ActionList,
  type ActionStatusChange,
  actionStatusSchema,
  type CreateAction,
  createActionSchema,
  type MyActions,
  type SaveAction,
  saveActionSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { type ActionScope, ActionsService } from './actions.service.js';

type Side = 'buyer' | 'supplier';

/** Gemeinsame Endpunkte beider Seiten; nur die Mandanten-Session unterscheidet sich. */
function routes(side: Side) {
  class SideActionsController {
    constructor(@Inject(ActionsService) readonly actions: ActionsService) {}

    run<T>(auth: AuthContext, id: string, work: (scope: ActionScope) => Promise<T>) {
      return side === 'buyer'
        ? this.actions.buyer(auth, id, work)
        : this.actions.supplier(auth, id, work);
    }

    @Get()
    @Requires('massnahmen.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ActionList> {
      return this.run(auth, id, (scope) => this.actions.list(scope));
    }

    @Post()
    @Requires('massnahmen.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(createActionSchema)) body: CreateAction,
    ): Promise<ActionItem> {
      return this.run(auth, id, (scope) => this.actions.create(scope, body));
    }

    @Get(':actionId')
    @Requires('massnahmen.sehen')
    get(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('actionId', ParseUUIDPipe) actionId: string,
    ): Promise<ActionItem> {
      return this.run(auth, id, (scope) => this.actions.get(scope, actionId));
    }

    @Put(':actionId')
    @Requires('massnahmen.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('actionId', ParseUUIDPipe) actionId: string,
      @Body(new ZodValidationPipe(saveActionSchema)) body: SaveAction,
    ): Promise<ActionItem> {
      return this.run(auth, id, (scope) => this.actions.update(scope, actionId, body));
    }

    @Put(':actionId/status')
    @Requires('massnahmen.bearbeiten')
    status(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('actionId', ParseUUIDPipe) actionId: string,
      @Body(new ZodValidationPipe(actionStatusSchema)) body: ActionStatusChange,
    ): Promise<ActionItem> {
      return this.run(auth, id, (scope) =>
        this.actions.setStatus(scope, actionId, body.status, body.evidence),
      );
    }
  }
  return SideActionsController;
}

/** Maßnahmen beim Käufer (QBR-03). */
@Controller('suppliers/:id/massnahmen')
export class BuyerActionsController extends routes('buyer') {}

/** Maßnahmen beim Lieferanten im Kontext des Kunden (QBR-03). */
@Controller('kunden/:id/massnahmen')
export class SupplierActionsController extends routes('supplier') {}

/** Alle offenen Maßnahmen der eigenen Beziehungen (QBR-03, /start/massnahmen). */
@Controller('start/massnahmen')
export class MyActionsController {
  constructor(@Inject(ActionsService) private readonly actions: ActionsService) {}

  @Get()
  @Requires('massnahmen.sehen')
  mine(@CurrentUser() auth: AuthContext): Promise<MyActions> {
    return this.actions.mine(auth);
  }
}
