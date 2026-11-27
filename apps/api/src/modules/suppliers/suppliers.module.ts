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
  // AK-01 (K2-c): Die Akte liest das Team beider Seiten über den TeamService
  exports: [SuppliersService, SpendMetricSource, TeamMetricSource, TeamService],
})
export class SuppliersModule {}
