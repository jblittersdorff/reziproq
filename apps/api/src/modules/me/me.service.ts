import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type Database, schema, sql } from '@reziproq/db';
import type { MeResponse } from '@reziproq/shared';
import { InjectDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { UserinfoClient } from './userinfo.client.js';

const { appUser } = schema;

@Injectable()
export class MeService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    @Inject(UserinfoClient) private readonly userinfo: UserinfoClient,
  ) {}

  /** Holt Name und E-Mail von Zitadel, speichert sie in app_user und liefert den gespeicherten Stand. */
  async syncFromUserinfo({ userId, accessToken }: AuthContext): Promise<MeResponse> {
    const { sub, name, email } = await this.userinfo.fetch(accessToken);
    // Userinfo muss zur selben Person gehören wie das Token (OpenID Connect Core 5.3.2).
    if (sub !== userId) throw new UnauthorizedException();

    const [user] = await this.db
      .insert(appUser)
      .values({ id: userId, name, email })
      .onConflictDoUpdate({ target: appUser.id, set: { name, email, updatedAt: sql`now()` } })
      .returning({ name: appUser.name, email: appUser.email });
    if (!user) throw new Error('app_user wurde nicht gespeichert.');
    return user;
  }
}
