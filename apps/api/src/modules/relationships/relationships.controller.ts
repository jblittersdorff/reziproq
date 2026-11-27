import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { type RelationshipsQuery, relationshipsQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AkteService } from './akte.service.js';
import { RelationshipsService } from './relationships.service.js';

/** BZ-01 (K2-b.3): Seite Lieferanten `/beziehungen`; AK-01 (K2-c): Akte `/beziehungen/<id>`. Nur für Käufer */
@Controller('beziehungen')
export class RelationshipsController {
  constructor(
    @Inject(RelationshipsService) private readonly relationships: RelationshipsService,
    @Inject(AkteService) private readonly akte: AkteService,
  ) {}

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

  /** Kopf der Akte (AK-01, K2-c.2) */
  @Get(':id')
  @Requires('lieferanten.sehen')
  head(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.akte.head(auth, id);
  }

  /** Akte, Sicht Gemeinsam (AK-01, K2-c.1): was beide Seiten gleich sehen */
  @Get(':id/gemeinsam')
  @Requires('lieferanten.sehen')
  shared(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.akte.shared(auth, id);
  }

  /** Akte, Sicht Von <Gegenüber> (AK-01, K2-c.4): was das Gegenüber aktiv geteilt hat */
  @Get(':id/geteilt')
  @Requires('lieferanten.sehen')
  counterpart(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.akte.counterpart(auth, id);
  }
}
