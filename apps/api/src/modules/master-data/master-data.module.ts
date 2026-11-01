import { Module } from '@nestjs/common';
import {
  AssignmentController,
  BusinessUnitsController,
  MaterialGroupsController,
} from './master-data.controller.js';
import { MasterDataService } from './master-data.service.js';

/** Business Units, Warengruppen und Zuordnung zu Lieferanten (PLT-06). */
@Module({
  controllers: [BusinessUnitsController, MaterialGroupsController, AssignmentController],
  providers: [MasterDataService],
})
export class MasterDataModule {}
