import { Controller, Get, Inject } from '@nestjs/common';
import type { MeResponse } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() auth: AuthContext): Promise<MeResponse> {
    return this.me.syncFromUserinfo(auth);
  }
}
