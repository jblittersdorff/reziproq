import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MergeService } from './merge.service.js';

// Status und Notiz prüft der Dienst (mit eigenem Fehlercode); hier nur ein Objekt.
const body = new ZodValidationPipe(z.record(z.string(), z.unknown()));

/** WG-20 (Schritt 31): Zusammenführung je Lieferant über alle Warengruppen */
@Controller('warengruppen')
export class MergeController {
  constructor(@Inject(MergeService) private readonly merge: MergeService) {}

  @Get('lieferanten/:relationshipId')
  @Requires('warengruppen.sehen')
  view(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.merge.view(auth, relationshipId);
  }

  @Post('lieferanten/:relationshipId/gesamtsegment')
  @Requires('warengruppen.sehen')
  adopt(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.merge.adopt(auth, relationshipId);
  }

  @Post('widersprueche/:conflictId')
  @Requires('warengruppen.sehen')
  resolve(
    @CurrentUser() auth: AuthContext,
    @Param('conflictId', ParseUUIDPipe) conflictId: string,
    @Body(body) input: Record<string, unknown>,
  ) {
    return this.merge.resolve(auth, conflictId, input);
  }
}
