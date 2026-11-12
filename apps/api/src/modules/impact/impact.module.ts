import { Module } from '@nestjs/common';
import { ImpactController, PnlLinesController } from './impact.controller.js';
import { ImpactService } from './impact.service.js';

/** GuV-Wirkung (PNL-01 ff.). */
@Module({
  controllers: [ImpactController, PnlLinesController],
  providers: [ImpactService],
  exports: [ImpactService],
})
export class ImpactModule {}
