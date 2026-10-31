import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
