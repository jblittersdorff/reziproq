import { Module } from '@nestjs/common';
import { PlaybookController } from './playbook.controller.js';
import { PlaybookService } from './playbook.service.js';
import { RuleSetsController } from './rule-sets.controller.js';
import { RuleSetsService } from './rule-sets.service.js';

@Module({
  controllers: [PlaybookController, RuleSetsController],
  providers: [PlaybookService, RuleSetsService],
})
export class PlaybookModule {}
