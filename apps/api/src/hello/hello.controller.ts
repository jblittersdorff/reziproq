import { Controller, Get, Query } from '@nestjs/common';
import { type HelloQuery, type HelloResponse, helloQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('hello')
export class HelloController {
  @Get()
  hello(@Query(new ZodValidationPipe(helloQuerySchema)) query: HelloQuery): HelloResponse {
    return { message: `Hallo, ${query.name}!` };
  }
}
