import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, TeamService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
