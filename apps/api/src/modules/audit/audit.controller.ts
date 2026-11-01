import { Controller, Get, Inject, Query } from '@nestjs/common';
import { type AuditQuery, type AuditResponse, auditQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @Requires('verlauf.sehen')
  history(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<AuditResponse> {
    return this.audit.history(auth, query);
  }
}
