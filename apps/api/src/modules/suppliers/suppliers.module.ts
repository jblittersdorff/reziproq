import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SpendMetricSource, TeamMetricSource } from './overview-metrics.js';
import { SupplierImportService } from './supplier-import.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [SuppliersController],
  providers: [
    SuppliersService,
    SupplierImportService,
    TeamService,
    SpendMetricSource,
    TeamMetricSource,
  ],
  exports: [SuppliersService, SpendMetricSource, TeamMetricSource],
})
export class SuppliersModule {}
