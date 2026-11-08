import { Module } from '@nestjs/common';
import { PlaybookController } from './playbook.controller.js';
import { PlaybookService } from './playbook.service.js';

@Module({ controllers: [PlaybookController], providers: [PlaybookService] })
export class PlaybookModule {}
