import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  BadRequestException,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type CommentList,
  type CommentObjectType,
  commentObjectTypes,
  type EditComment,
  editCommentSchema,
  type SaveComment,
  saveCommentSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { type CommentScope, CommentsService } from './comments.service.js';

/**
 * Art des Objekts erst nach der Prüfung der Seite: Wer die Beziehung gar nicht sehen darf, bekommt
 * 403 bzw. 404, nie 400 für eine unbekannte Art (LIF-02).
 */
const parseType = (type: string): CommentObjectType => {
  if (!(commentObjectTypes as readonly string[]).includes(type)) {
    throw new BadRequestException({ statusCode: 400, code: 'objektart_unbekannt' });
  }
  return type as CommentObjectType;
};

type Side = 'buyer' | 'supplier';

/** Gemeinsame Endpunkte beider Seiten; nur der Einstieg (Käufer oder Kunde) unterscheidet sich. */
abstract class CommentsEndpoints {
  constructor(
    protected readonly comments: CommentsService,
    private readonly side: Side,
  ) {}

  private run<T>(auth: AuthContext, id: string, work: (scope: CommentScope) => Promise<T>) {
    return this.side === 'buyer'
      ? this.comments.buyer(auth, id, work)
      : this.comments.supplier(auth, id, work);
  }

  @Get(':type/:objectId')
  @Requires('kommentare.schreiben')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Param('objectId', ParseUUIDPipe) objectId: string,
  ): Promise<CommentList> {
    return this.run(auth, id, (scope) => this.comments.list(scope, parseType(type), objectId));
  }

  @Post(':type/:objectId')
  @Requires('kommentare.schreiben')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Param('objectId', ParseUUIDPipe) objectId: string,
    @Body(new ZodValidationPipe(saveCommentSchema)) body: SaveComment,
  ): Promise<CommentList> {
    return this.run(auth, id, (scope) => this.comments.create(scope, parseType(type), objectId, body));
  }

  @Put(':type/:objectId/:commentId')
  @Requires('kommentare.schreiben')
  edit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Param('objectId', ParseUUIDPipe) objectId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body(new ZodValidationPipe(editCommentSchema)) body: EditComment,
  ): Promise<CommentList> {
    return this.run(auth, id, (scope) =>
      this.comments.edit(scope, parseType(type), objectId, commentId, body),
    );
  }

  @Delete(':type/:objectId/:commentId')
  @Requires('kommentare.schreiben')
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Param('objectId', ParseUUIDPipe) objectId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<CommentList> {
    return this.run(auth, id, (scope) => this.comments.remove(scope, parseType(type), objectId, commentId));
  }
}

/** QS-02: Kommentare beim Käufer. */
@Controller('suppliers/:id/kommentare')
export class BuyerCommentsController extends CommentsEndpoints {
  constructor(@Inject(CommentsService) comments: CommentsService) {
    super(comments, 'buyer');
  }
}

/** QS-02: Kommentare beim Lieferanten, im Kontext des Kunden. */
@Controller('kunden/:id/kommentare')
export class SupplierCommentsController extends CommentsEndpoints {
  constructor(@Inject(CommentsService) comments: CommentsService) {
    super(comments, 'supplier');
  }
}
