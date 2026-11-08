import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type CreateMeeting,
  createMeetingSchema,
  type MeetingDetail,
  type MeetingList,
  type SaveAgenda,
  type SaveMeetingNote,
  type SaveProtocol,
  saveAgendaSchema,
  saveMeetingNoteSchema,
  saveProtocolSchema,
  type UpdateMeeting,
  updateMeetingSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MeetingsService } from './meetings.service.js';

/** Termine beim Käufer (QBR-01a). */
@Controller('suppliers/:id/termine')
export class BuyerMeetingsController {
  constructor(@Inject(MeetingsService) private readonly meetings: MeetingsService) {}

  @Get()
  @Requires('termine.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeetingList> {
    return this.meetings.buyer(auth, id, (scope) => this.meetings.list(scope));
  }

  @Post()
  @Requires('termine.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createMeetingSchema)) body: CreateMeeting,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) => this.meetings.create(scope, body));
  }

  @Get(':meetingId')
  @Requires('termine.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) => this.meetings.detail(scope, meetingId));
  }

  @Put(':meetingId')
  @Requires('termine.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(updateMeetingSchema)) body: UpdateMeeting,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) => this.meetings.update(scope, meetingId, body));
  }

  @Put(':meetingId/agenda')
  @Requires('termine.bearbeiten')
  agenda(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveAgendaSchema)) body: SaveAgenda,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) =>
      this.meetings.saveAgenda(scope, meetingId, body),
    );
  }

  @Put(':meetingId/protokoll')
  @Requires('termine.bearbeiten')
  protocol(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveProtocolSchema)) body: SaveProtocol,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) =>
      this.meetings.saveProtocol(scope, meetingId, body),
    );
  }

  @Put(':meetingId/notiz')
  @Requires('termine.bearbeiten')
  note(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveMeetingNoteSchema)) body: SaveMeetingNote,
  ): Promise<MeetingDetail> {
    return this.meetings.buyer(auth, id, (scope) => this.meetings.saveNote(scope, meetingId, body));
  }
}

/** Termine beim Lieferanten im Kontext des Kunden (QBR-01a). */
@Controller('kunden/:id/termine')
export class SupplierMeetingsController {
  constructor(@Inject(MeetingsService) private readonly meetings: MeetingsService) {}

  @Get()
  @Requires('termine.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeetingList> {
    return this.meetings.supplier(auth, id, (scope) => this.meetings.list(scope));
  }

  @Post()
  @Requires('termine.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createMeetingSchema)) body: CreateMeeting,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) => this.meetings.create(scope, body));
  }

  @Get(':meetingId')
  @Requires('termine.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) => this.meetings.detail(scope, meetingId));
  }

  @Put(':meetingId')
  @Requires('termine.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(updateMeetingSchema)) body: UpdateMeeting,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) =>
      this.meetings.update(scope, meetingId, body),
    );
  }

  @Put(':meetingId/agenda')
  @Requires('termine.bearbeiten')
  agenda(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveAgendaSchema)) body: SaveAgenda,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) =>
      this.meetings.saveAgenda(scope, meetingId, body),
    );
  }

  @Put(':meetingId/protokoll')
  @Requires('termine.bearbeiten')
  protocol(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveProtocolSchema)) body: SaveProtocol,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) =>
      this.meetings.saveProtocol(scope, meetingId, body),
    );
  }

  @Put(':meetingId/notiz')
  @Requires('termine.bearbeiten')
  note(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveMeetingNoteSchema)) body: SaveMeetingNote,
  ): Promise<MeetingDetail> {
    return this.meetings.supplier(auth, id, (scope) =>
      this.meetings.saveNote(scope, meetingId, body),
    );
  }
}
