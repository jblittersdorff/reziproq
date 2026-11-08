import { Controller, Get, Inject, Query } from '@nestjs/common';
import { type PortfolioMatrixQuery, portfolioMatrixQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PortfolioService } from './portfolio.service.js';

@Controller('portfolio')
export class PortfolioController {
  constructor(@Inject(PortfolioService) private readonly portfolio: PortfolioService) {}

  @Get()
  @Requires('portfolio.sehen')
  overview(@CurrentUser() auth: AuthContext) {
    return this.portfolio.overview(auth);
  }

  @Get('matrix')
  @Requires('portfolio.sehen')
  matrix(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(portfolioMatrixQuerySchema)) query: PortfolioMatrixQuery,
  ) {
    return this.portfolio.matrix(auth, query);
  }

  @Get('open')
  @Requires('portfolio.sehen')
  open(@CurrentUser() auth: AuthContext) {
    return this.portfolio.open(auth);
  }
}
