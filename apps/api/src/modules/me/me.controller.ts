import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { type MeResponse, meResponseSchema } from '@reziproq/shared';
import type { JWTPayload } from 'jose';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: JWTPayload): MeResponse {
    const result = meResponseSchema.safeParse(user);
    if (!result.success) {
      throw new UnauthorizedException('Das Token enthält keinen Namen oder keine E-Mail.');
    }
    return result.data;
  }
}
