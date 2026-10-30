import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';

// SupportAccessService stellt das globale AuthModule bereit, weil der Guard ihn braucht.
@Module({ controllers: [SupportController] })
export class SupportModule {}
