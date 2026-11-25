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
import { DoneService } from './done.service.js';
import { TriageService } from './triage.service.js';

// HE-01 (K1-c): Heute aus der Triage; seit K1-e mit den Ansichten Fokus und Alles. Start und Mein Tag
// lesen „Als Nächstes“ weiter von hier (NAV-10 1.1, gleiche Pfade wie bisher).

@Controller()
export class TodayController {
  constructor(
    @Inject(TriageService) private readonly triage: TriageService,
    @Inject(StartService) private readonly start: StartService,
    @Inject(DoneService) private readonly done: DoneService,
  ) {}

  /** Heute, Ansicht Fokus: „Als Nächstes“, höchstens zwei weitere Fokus-Themen, Kurz prüfen, Erledigt */
  @Get('heute')
  @Requires('start.sehen')
  today(@CurrentUser() auth: AuthContext) {
    return this.triage.today(auth);
  }

  /** Heute, Ansicht Alles: alles Offene der Person in Gruppen, nichts ausgeblendet (HE-01) */
  @Get('heute/alles')
  @Requires('start.sehen')
  all(@CurrentUser() auth: AuthContext) {
    return this.triage.all(auth);
  }

  /** Erledigt im Hintergrund (K1-e.3): Läufe von Reziproq für die Person, mit Rücknahme */
  @Get('erledigt')
  @Requires('start.sehen')
  doneList(@CurrentUser() auth: AuthContext) {
    return this.done.list(auth);
  }

  /** Zurücknehmen: bis 30 Tage, solange das Objekt unverändert ist (HE-01 Dienst 3) */
  @Post('erledigt/:id/zuruecknehmen')
  @HttpCode(200)
  @Requires('start.sehen')
  undo(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.done.undo(auth, id);
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
