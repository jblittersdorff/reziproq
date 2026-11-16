import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
