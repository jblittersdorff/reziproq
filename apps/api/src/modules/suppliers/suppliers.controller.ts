import { Controller, Get, Inject } from '@nestjs/common';
import type { SuppliersResponse } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SuppliersService } from './suppliers.service.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly suppliers: SuppliersService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext): Promise<SuppliersResponse> {
    return this.suppliers.list(auth);
  }
}
