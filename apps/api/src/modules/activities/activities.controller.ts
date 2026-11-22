import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  activityFilters,
  type NotePatch,
  type NoteRequest,
  notePatchSchema,
  noteRequestSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ActivitiesService } from './activities.service.js';

const filterQuery = new ZodValidationPipe(z.enum(activityFilters).optional());

/** NAV-10: Aktivitäten eines Lieferanten und Notizen (nur Käufer). */
@Controller('suppliers/:id')
export class ActivitiesController {
  constructor(@Inject(ActivitiesService) private readonly activities: ActivitiesService) {}

  @Get('aktivitaeten')
  @Requires('aktivitaeten.sehen')
  feed(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('filter', filterQuery) filter: (typeof activityFilters)[number] | undefined,
  ) {
    return this.activities.feed(auth, id, filter);
  }

  @Post('notizen')
  @Requires('notizen.schreiben')
  add(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(noteRequestSchema)) body: NoteRequest,
  ) {
    return this.activities.addNote(auth, id, body);
  }

  @Patch('notizen/:noteId')
  @Requires('notizen.schreiben')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body(new ZodValidationPipe(notePatchSchema)) body: NotePatch,
  ) {
    return this.activities.updateNote(auth, id, noteId, body);
  }

  @Delete('notizen/:noteId')
  @Requires('notizen.schreiben')
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.activities.removeNote(auth, id, noteId);
  }
}
