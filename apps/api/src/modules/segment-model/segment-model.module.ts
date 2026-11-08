import { Module } from '@nestjs/common';
import { SegmentModelController } from './segment-model.controller.js';
import { SegmentModelService } from './segment-model.service.js';

@Module({
  controllers: [SegmentModelController],
  providers: [SegmentModelService],
})
export class SegmentModelModule {}
