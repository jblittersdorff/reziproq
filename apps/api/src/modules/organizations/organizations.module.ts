import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';

@Module({
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
