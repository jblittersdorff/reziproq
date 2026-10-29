import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type ZodType, z } from 'zod';

/** Prüft eingehende Daten (Body, Query, Params) gegen ein zod-Schema. */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Ungültige Eingabe',
        errors: z.flattenError(result.error).fieldErrors,
      });
    }
    return result.data;
  }
}
