import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SpendMetricSource, TeamMetricSource } from './overview-metrics.js';
import { SpendService } from './spend.service.js';
import { SupplierImportService } from './supplier-import.service.js';
import {
  RolesController,
  SuppliersController,
  SupplierTeamController,
} from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [OrganizationsModule, CustomersModule],
  controllers: [SuppliersController, SupplierTeamController, RolesController],
  providers: [
    SuppliersService,
    SupplierImportService,
    SpendService,
    TeamService,
    SpendMetricSource,
    TeamMetricSource,
  ],
  exports: [SuppliersService, SpendMetricSource, TeamMetricSource],
})
export class SuppliersModule {}
