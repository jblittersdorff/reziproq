import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { type SetWorkerLevel, setWorkerLevelSchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MyAgentService } from './my-agent.service.js';

/** MA-01 Mein Agent (K1-f): eigene Stufen je Aufgabe von Reziproq */
@Controller('mein-agent')
export class MyAgentController {
  constructor(@Inject(MyAgentService) private readonly myAgent: MyAgentService) {}

  @Get()
  @Requires('start.sehen')
  view(@CurrentUser() auth: AuthContext) {
    return this.myAgent.view(auth);
  }

  @Put(':key')
  @Requires('mein_agent.einstellen')
  setLevel(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(setWorkerLevelSchema)) input: SetWorkerLevel,
  ) {
    return this.myAgent.setLevel(auth, key, input.level);
  }
}
