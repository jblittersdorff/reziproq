import { Controller, Get, Inject, Query } from '@nestjs/common';
import { type RelationshipsQuery, relationshipsQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { RelationshipsService } from './relationships.service.js';

/** BZ-01 (K2-b.3): Seite Lieferanten `/beziehungen`, nur für Käufer */
@Controller('beziehungen')
export class RelationshipsController {
  constructor(@Inject(RelationshipsService) private readonly relationships: RelationshipsService) {}

  /** Linse Liste; `portfolio=1` nimmt die Entwürfe dazu (E-K2-10) */
  @Get()
  @Requires('lieferanten.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(relationshipsQuerySchema)) query: RelationshipsQuery,
  ) {
    return this.relationships.list(auth, query);
  }

  /** Linse Segmente über das ganze Portfolio */
  @Get('segmente')
  @Requires('portfolio.sehen')
  segments(@CurrentUser() auth: AuthContext) {
    return this.relationships.segments(auth);
  }
}
