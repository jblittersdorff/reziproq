import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  type CreateSupplierRequest,
  type CreateSupplierResponse,
  createSupplierRequestSchema,
  type SpendRequest,
  type SupplierDetail,
  type SupplierLookupQuery,
  type SupplierLookupResponse,
  type SuppliersResponse,
  spendRequestSchema,
  spendYearSchema,
  supplierLookupQuerySchema,
  type UpdateSupplierRequest,
  updateSupplierRequestSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SuppliersService } from './suppliers.service.js';

const yearParam = new ZodValidationPipe(z.coerce.number().pipe(spendYearSchema));

@Controller('suppliers')
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly suppliers: SuppliersService) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<SuppliersResponse> {
    return this.suppliers.list(auth);
  }

  /** Gibt es diese USt-IdNr. oder D-U-N-S schon? Nur ja oder nein (PLT-03). */
  @Get('lookup')
  @Requires('lieferanten.bearbeiten')
  lookup(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(supplierLookupQuerySchema)) query: SupplierLookupQuery,
  ): Promise<SupplierLookupResponse> {
    return this.suppliers.lookup(auth, query);
  }

  @Post()
  @Requires('lieferanten.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createSupplierRequestSchema)) body: CreateSupplierRequest,
  ): Promise<CreateSupplierResponse> {
    return this.suppliers.create(auth, body);
  }

  @Get(':id')
  @Requires('lieferanten.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetail> {
    return this.suppliers.detail(auth, id);
  }

  @Patch(':id')
  @Requires('lieferanten.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSupplierRequestSchema)) body: UpdateSupplierRequest,
  ): Promise<SupplierDetail> {
    return this.suppliers.update(auth, id, body);
  }

  @Post(':id/beenden')
  @Requires('lieferanten.bearbeiten')
  @HttpCode(200)
  end(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetail> {
    return this.suppliers.end(auth, id);
  }

  @Put(':id/spend/:year')
  @Requires('lieferanten.bearbeiten')
  putSpend(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('year', yearParam) year: number,
    @Body(new ZodValidationPipe(spendRequestSchema)) body: SpendRequest,
  ): Promise<SupplierDetail> {
    return this.suppliers.putSpend(auth, id, year, body);
  }
}
