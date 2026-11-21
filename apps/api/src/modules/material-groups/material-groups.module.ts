import { Module } from '@nestjs/common';
import { MaterialGroupsController } from './material-groups.controller.js';
import { MaterialGroupsService } from './material-groups.service.js';
import { StrategyController } from './strategy.controller.js';
import { StrategyService } from './strategy.service.js';

/** Warengruppenmanagement (Release 1.1): WG-01, WG-04, WG-06 */
@Module({
  // Strategie zuerst: feste Pfade wie /warengruppen/strategien vor /warengruppen/:id
  controllers: [StrategyController, MaterialGroupsController],
  providers: [MaterialGroupsService, StrategyService],
  exports: [StrategyService],
})
export class MaterialGroupsModule {}
