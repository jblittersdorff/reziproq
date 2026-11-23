import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  type ApiBatchRequest,
  type ApiBatchResponse,
  apiBatchRequestSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { type ApiPrincipal, ApiKeysService } from '../integrations/api-keys.service.js';
import { ImportApiService } from './import-api.service.js';
import { openApiDocument } from './openapi.js';

/**
 * IN-07 Import-API unter /api/v1. Ohne Login der App: Anmeldung mit Authorization: Bearer
 * <Schlüssel>, Rechte aus den Objektarten des Schlüssels und der Person, die ihn erzeugt hat.
 * Höchstens 60 Aufrufe je Minute und Schlüssel, sonst 429 mit Retry-After.
 */
@Controller('v1')
@Public()
export class ImportApiController {
  constructor(
    @Inject(ApiKeysService) private readonly keys: ApiKeysService,
    @Inject(ImportApiService) private readonly api: ImportApiService,
  ) {}

  private async principal(header: string | undefined, response: Response): Promise<ApiPrincipal> {
    const principal = await this.keys.authenticate(header);
    const wait = this.api.rateLimit.take(principal.keyId);
    if (wait > 0) {
      response.setHeader('Retry-After', String(wait));
      throw new HttpException({ statusCode: 429, code: 'zu_viele_aufrufe' }, 429);
    }
    return principal;
  }

  @Get('openapi.json')
  openapi() {
    return openApiDocument;
  }

  @Post('batches')
  @HttpCode(202)
  async deliver(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(apiBatchRequestSchema)) body: ApiBatchRequest,
  ): Promise<ApiBatchResponse> {
    return this.api.deliver(await this.principal(authorization, response), body);
  }

  @Get('batches/:id')
  async status(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiBatchResponse> {
    return this.api.status(await this.principal(authorization, response), id);
  }
}
