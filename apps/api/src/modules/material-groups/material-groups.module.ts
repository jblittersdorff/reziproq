import { Module } from '@nestjs/common';
import { MaterialGroupsController } from './material-groups.controller.js';
import { MaterialGroupsService } from './material-groups.service.js';

/** Warengruppenmanagement (Release 1.1), Paket 1: WG-01 */
@Module({
  controllers: [MaterialGroupsController],
  providers: [MaterialGroupsService],
})
export class MaterialGroupsModule {}
