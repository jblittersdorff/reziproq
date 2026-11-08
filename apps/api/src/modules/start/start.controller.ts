import { Controller, Get, Inject } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { StartService } from './start.service.js';

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
}
