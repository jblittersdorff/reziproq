import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { ImpactController, PnlLinesController, ValidationController } from './impact.controller.js';
import { ImpactService } from './impact.service.js';
import { ValidationService } from './validation.service.js';

/** GuV-Wirkung (PNL-01 ff.). */
@Module({
  imports: [EmailModule],
  controllers: [ImpactController, PnlLinesController, ValidationController],
  providers: [ImpactService, ValidationService],
  exports: [ImpactService, ValidationService],
})
export class ImpactModule {}
