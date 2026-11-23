import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type ReviewCustomAgent,
  reviewCustomAgentSchema,
  type SaveCustomAgent,
  saveCustomAgentSchema,
  startCustomAgentSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { CustomAgentsService } from './custom-agents.service.js';

/** KI-09: eigene Agenten (nur Käufer) */
@Controller('ki/eigene-agenten')
export class CustomAgentsController {
  constructor(@Inject(CustomAgentsService) private readonly agents: CustomAgentsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(@CurrentUser() auth: AuthContext) {
    return this.agents.list(auth);
  }

  @Get('optionen')
  @Requires('lieferanten.sehen')
  options(@CurrentUser() auth: AuthContext) {
    return this.agents.options(auth);
  }

  @Post()
  @Requires('lieferanten.sehen')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveCustomAgentSchema)) body: SaveCustomAgent,
  ) {
    return this.agents.create(auth, body);
  }

  @Get('laeufe/:runId/ergebnisse')
  @Requires('lieferanten.sehen')
  results(@CurrentUser() auth: AuthContext, @Param('runId', ParseUUIDPipe) runId: string) {
    return this.agents.results(auth, runId);
  }

  @Post('entwuerfe/:draftId/uebernehmen')
  @HttpCode(204)
  @Requires('lieferanten.sehen')
  async accept(@CurrentUser() auth: AuthContext, @Param('draftId', ParseUUIDPipe) draftId: string) {
    await this.agents.accept(auth, draftId);
  }

  @Post('entwuerfe/:draftId/verwerfen')
  @HttpCode(204)
  @Requires('lieferanten.sehen')
  async discard(
    @CurrentUser() auth: AuthContext,
    @Param('draftId', ParseUUIDPipe) draftId: string,
  ) {
    await this.agents.discard(auth, draftId);
  }

  @Get(':id')
  @Requires('lieferanten.sehen')
  detail(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.detail(auth, id);
  }

  @Put(':id')
  @Requires('lieferanten.sehen')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveCustomAgentSchema)) body: SaveCustomAgent,
  ) {
    return this.agents.update(auth, id, body);
  }

  @Post(':id/starten')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  start(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(startCustomAgentSchema)) body: { isTest: boolean },
  ) {
    return this.agents.start(auth, id, body.isTest);
  }

  @Post(':id/aktivieren')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  activate(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.activate(auth, id);
  }

  @Post(':id/pausieren')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  pause(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.pause(auth, id);
  }

  @Post(':id/pruefung')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  review(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewCustomAgentSchema)) body: ReviewCustomAgent,
  ) {
    return this.agents.review(auth, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Requires('lieferanten.sehen')
  async remove(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.agents.remove(auth, id);
  }
}
