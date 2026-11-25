import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller.js';

/** DM-01: Demo-Mandant und Demo-Regie (K1-b, K1-g); Demo-Tokens kommen aus dem Auth-Modul */
@Module({ controllers: [DemoController] })
export class DemoModule {}
