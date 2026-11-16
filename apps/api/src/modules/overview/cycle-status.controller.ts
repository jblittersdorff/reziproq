import { Controller, Get, Inject, Query } from '@nestjs/common';
import { type CycleStatus, type CycleStatusQuery, cycleStatusQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { CycleStatusService } from './cycle-status.service.js';

/** ZYK-04: Portfolio › Stand der Zyklen, nur beim Käufer. */
@Controller('portfolio/zyklen')
export class CycleStatusController {
  constructor(@Inject(CycleStatusService) private readonly cycles: CycleStatusService) {}

  @Get()
  @Requires('portfolio.sehen')
  status(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(cycleStatusQuerySchema)) query: CycleStatusQuery,
  ): Promise<CycleStatus> {
    return this.cycles.status(auth, query);
  }
}
