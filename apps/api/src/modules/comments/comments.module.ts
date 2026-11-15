import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { BuyerCommentsController, SupplierCommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

/** Kommentare an Initiativen, Zusagen, Maßnahmen, Terminen, Themen und Spielregeln (QS-02). */
@Module({
  imports: [CustomersModule, ActionsModule],
  controllers: [BuyerCommentsController, SupplierCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
