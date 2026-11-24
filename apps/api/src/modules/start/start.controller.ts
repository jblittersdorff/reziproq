import { Controller, Get, Inject, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { StartService } from './start.service.js';

const daysQuery = new ZodValidationPipe(z.coerce.number().int().min(1).max(60).optional());

@Controller('start')
export class StartController {
  constructor(@Inject(StartService) private readonly start: StartService) {}

  @Get()
  @Requires('start.sehen')
  overview(@CurrentUser() auth: AuthContext) {
    return this.start.overview(auth);
  }

  @Get('due')
  @Requires('start.sehen')
  due(@CurrentUser() auth: AuthContext) {
    return this.start.due(auth);
  }

  /** NAV-10 1.1: Mein Tag mit „Als Nächstes“, Heute, Diese Woche, Wartet auf andere */
  @Get('mein-tag')
  @Requires('start.sehen')
  myDay(@CurrentUser() auth: AuthContext) {
    return this.start.myDay(auth);
  }

  /** Terminschiene (`timeline_item`) der nächsten Tage, Standard vier Wochen */
  @Get('termine')
  @Requires('start.sehen')
  timeline(@CurrentUser() auth: AuthContext, @Query('tage', daysQuery) days: number | undefined) {
    return this.start.timeline(auth, days ?? 28);
  }

  /** „Als Nächstes“ über alle Bereiche (`next_action`, scope global) */
  @Get('als-naechstes')
  @Requires('start.sehen')
  next(@CurrentUser() auth: AuthContext) {
    return this.start.next(auth);
  }

  /** Lieferanten, die die Person brauchen (F-UX-06) */
  @Get('brauchen-dich')
  @Requires('start.sehen')
  needsYou(@CurrentUser() auth: AuthContext) {
    return this.start.needsYou(auth);
  }
}
