import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import type { CustomerList, CustomerRuleSet, CustomerWorkspace } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { CustomersService } from './customers.service.js';

/** Kunden der Lieferantenseite und ihr Arbeitsbereich (LIF-02). */
@Controller('kunden')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  @Get()
  @Requires('kunden.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<CustomerList> {
    return this.customers.list(auth);
  }

  @Get(':id')
  @Requires('kunden.sehen')
  workspace(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerWorkspace> {
    return this.customers.workspace(auth, id);
  }

  /** Geteilte Spielregeln dieses Kunden (SEG-10). */
  @Get(':id/spielregeln')
  @Requires('kunden.sehen')
  ruleSet(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerRuleSet> {
    return this.customers.ruleSet(auth, id);
  }
}
