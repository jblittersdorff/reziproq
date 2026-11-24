import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { StartService } from '../start/start.service.js';
import { TriageService } from './triage.service.js';

// HE-01 (K1-c): Heute aus der Triage. Die Seite kommt mit K1-e; bis dahin lesen Start und Mein Tag
// „Als Nächstes“ von hier (NAV-10 1.1, gleiche Pfade wie bisher).

@Controller()
export class TodayController {
  constructor(
    @Inject(TriageService) private readonly triage: TriageService,
    @Inject(StartService) private readonly start: StartService,
  ) {}

  /** Heute: „Als Nächstes“, höchstens zwei weitere Fokus-Themen, Kurz prüfen, Erledigt */
  @Get('heute')
  @Requires('start.sehen')
  today(@CurrentUser() auth: AuthContext) {
    return this.triage.today(auth);
  }

  /** „Morgen erinnern“: bis zum nächsten Tag 07:00 */
  @Post('heute/:id/morgen')
  @HttpCode(200)
  @Requires('start.sehen')
  snooze(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.triage.snooze(auth, id);
  }

  /** „Als Nächstes“ (`next_action`): scope global, mit `beziehung` scope relationship */
  @Get('start/als-naechstes')
  @Requires('start.sehen')
  async next(
    @CurrentUser() auth: AuthContext,
    @Query('beziehung', new ParseUUIDPipe({ optional: true })) relationshipId: string | undefined,
  ) {
    return { next: await this.triage.nextAction(auth, { relationshipId }) };
  }

  /** NAV-10 1.1: Mein Tag mit „Als Nächstes“ aus der Triage, Heute, Diese Woche, Wartet auf andere */
  @Get('start/mein-tag')
  @Requires('start.sehen')
  myDay(@CurrentUser() auth: AuthContext) {
    return this.start.myDay(auth, (due) => this.triage.nextAction(auth, { due }));
  }
}
