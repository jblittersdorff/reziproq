import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { type SetFocusRequest, setFocusRequestSchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { FocusService } from './focus.service.js';

@Controller('portfolio/fokus')
export class FocusController {
  constructor(@Inject(FocusService) private readonly focus: FocusService) {}

  @Get()
  @Requires('portfolio.sehen')
  list(@CurrentUser() auth: AuthContext) {
    return this.focus.list(auth);
  }

  @Get(':id')
  @Requires('portfolio.sehen')
  detail(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.focus.detail(auth, id);
  }

  @Put(':id')
  @Requires('fokus.setzen')
  set(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setFocusRequestSchema)) body: SetFocusRequest,
  ) {
    return this.focus.set(auth, id, body);
  }
}
