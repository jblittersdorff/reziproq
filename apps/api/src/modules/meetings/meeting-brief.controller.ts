import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type BriefSettings,
  briefSettingsSchema,
  type DismissAiDraft,
  dismissAiDraftSchema,
  type EditBriefAgenda,
  editBriefAgendaSchema,
  type MeetingBrief,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MeetingBriefService } from './meeting-brief.service.js';

/** KI-07 Termin-Briefing je Termin; nur im Käuferpfad, der Lieferant hat keinen Zugang. */
@Controller('suppliers/:id/termine/:meetingId/briefing')
export class MeetingBriefController {
  constructor(@Inject(MeetingBriefService) private readonly brief: MeetingBriefService) {}

  @Get()
  @Requires('termine.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingBrief> {
    return this.brief.get(auth, id, meetingId);
  }

  @Post(':draftId/uebernehmen')
  @HttpCode(200)
  @Requires('termine.sehen')
  accept(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
  ): Promise<MeetingBrief> {
    return this.brief.decide(auth, id, meetingId, draftId, { status: 'accepted' });
  }

  @Post(':draftId/verwerfen')
  @HttpCode(200)
  @Requires('termine.sehen')
  discard(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(dismissAiDraftSchema.optional())) body: DismissAiDraft | undefined,
  ): Promise<MeetingBrief> {
    return this.brief.decide(auth, id, meetingId, draftId, {
      status: 'discarded',
      reason: body?.reason ?? null,
    });
  }

  @Put('agenda')
  @Requires('termine.bearbeiten')
  editAgenda(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(editBriefAgendaSchema)) body: EditBriefAgenda,
  ): Promise<MeetingBrief> {
    return this.brief.editAgenda(auth, id, meetingId, body);
  }

  @Post('fragen/:key/senden')
  @HttpCode(200)
  @Requires('termine.sehen')
  send(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('key') key: string,
  ): Promise<MeetingBrief> {
    return this.brief.sendQuestion(auth, id, meetingId, key);
  }
}

/** Einstellungen › Termin-Briefing: Vorlauf je Termintyp; nur Admins. */
@Controller('einstellungen/termin-briefing')
export class BriefSettingsController {
  constructor(
    @Inject(MeetingBriefService) private readonly brief: MeetingBriefService,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
  ) {}

  private session(auth: AuthContext) {
    if (!auth.organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return { userId: auth.userId, organizationId: auth.organization.id };
  }

  @Get()
  @Requires('einstellungen.verwalten')
  get(@CurrentUser() auth: AuthContext): Promise<BriefSettings> {
    const session = this.session(auth);
    return this.tenant.run(session, (tx) => this.brief.readSettings(tx, session.organizationId), {
      readOnly: true,
    });
  }

  @Put()
  @Requires('einstellungen.verwalten')
  save(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(briefSettingsSchema)) body: BriefSettings,
  ): Promise<BriefSettings> {
    const session = this.session(auth);
    return this.tenant.run(session, (tx) =>
      this.brief.saveSettings(tx, session.organizationId, auth.userId, body),
    );
  }
}
