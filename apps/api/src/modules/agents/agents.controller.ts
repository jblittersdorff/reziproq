import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  resumeAgentSchema,
  type StartAgent,
  setAgentStateSchema,
  startAgentSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AgentsService } from './agents.service.js';

@Controller('ki/agenten')
export class AgentsController {
  constructor(@Inject(AgentsService) private readonly agents: AgentsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(@CurrentUser() auth: AuthContext) {
    return this.agents.list(auth);
  }

  @Get('laeufe/:id')
  @Requires('lieferanten.sehen')
  run(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.detail(auth, id);
  }

  @Post('laeufe/:id/abbrechen')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  cancel(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.cancel(auth, id);
  }

  @Post('laeufe/:id/fortsetzen')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  resume(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resumeAgentSchema.optional())) input:
      | { answer?: string | undefined }
      | undefined,
  ) {
    return this.agents.resume(auth, id, input?.answer);
  }

  @Get(':id')
  @Requires('lieferanten.sehen')
  definition(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.definition(auth, id);
  }

  @Put(':id/aktivierung')
  @Requires('einstellungen.verwalten')
  enabled(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setAgentStateSchema)) input: { enabled: boolean },
  ) {
    return this.agents.setEnabled(auth, id, input.enabled);
  }

  @Post(':id/starten')
  @Requires('lieferanten.sehen')
  start(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(startAgentSchema)) input: StartAgent,
  ) {
    return this.agents.start(auth, id, input);
  }
}
