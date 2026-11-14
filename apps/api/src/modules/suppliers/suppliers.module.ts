import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SpendMetricSource, TeamMetricSource } from './overview-metrics.js';
import { SupplierProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
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
  controllers: [
    SuppliersController,
    SupplierTeamController,
    RolesController,
    SupplierProfileController,
  ],
  providers: [
    SuppliersService,
    SupplierImportService,
    SpendService,
    ProfileService,
    TeamService,
    SpendMetricSource,
    TeamMetricSource,
  ],
  exports: [SuppliersService, SpendMetricSource, TeamMetricSource],
})
export class SuppliersModule {}
