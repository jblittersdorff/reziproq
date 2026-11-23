import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type AddinDetect,
  type AddinRegister,
  type AddinRegistered,
  addinDetectRequestSchema,
  addinRegisterSchema,
  type DecideInbound,
  decideInboundSchema,
  type Inbox,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { CalendarIntakeService } from './calendar.service.js';

/** IN-03 Mein Tag › Neu eingegangen: Eingänge zuordnen, als Ereignis speichern, ignorieren. */
@Controller('mein-tag/eingang')
export class InboxController {
  constructor(@Inject(CalendarIntakeService) private readonly intake: CalendarIntakeService) {}

  @Get()
  @Requires('termine.sehen')
  inbox(@CurrentUser() auth: AuthContext): Promise<Inbox> {
    return this.intake.inbox(auth);
  }

  @Post(':id/entscheiden')
  @HttpCode(200)
  @Requires('termine.sehen')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideInboundSchema)) body: DecideInbound,
  ): Promise<Inbox> {
    return this.intake.decide(auth, id, body);
  }
}

/** IN-03 Outlook-Add-in: Lieferant erkennen und „Als Aktivität speichern“. */
@Controller('termine/addin')
export class AddinController {
  constructor(@Inject(CalendarIntakeService) private readonly intake: CalendarIntakeService) {}

  @Post('erkennen')
  @HttpCode(200)
  @Requires('termine.sehen')
  detect(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(addinDetectRequestSchema)) body: { attendees: string[]; subject: string },
  ): Promise<AddinDetect> {
    return this.intake.detect(auth, body);
  }

  @Post()
  @Requires('termine.bearbeiten')
  register(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(addinRegisterSchema)) body: AddinRegister,
  ): Promise<AddinRegistered> {
    return this.intake.register(auth, body);
  }
}
