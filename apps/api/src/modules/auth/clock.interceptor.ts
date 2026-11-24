import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { withDemoClock } from '@reziproq/db';
import { from, Observable, switchMap } from 'rxjs';
import { AccountStore } from '../../common/database.module.js';
import type { AuthContext } from './auth.guard.js';

/**
 * DM-01: Uhr je Mandant für die ganze Anfrage. Läuft nach dem AuthGuard; gehört die Organisation
 * der Anfrage zum Demo-Mandanten, gilt deren Demo-Uhr auch für Code außerhalb einer
 * Mandanten-Transaktion (Dateinamen, Fristen vor dem Speichern). Ohne Demo-Uhr ändert sich nichts.
 */
@Injectable()
export class ClockInterceptor implements NestInterceptor {
  constructor(@Inject(AccountStore) private readonly accounts: AccountStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const orgId = context.switchToHttp().getRequest<{ auth?: AuthContext }>().auth
      ?.organization?.id;
    if (!orgId) return next.handle();
    return from(this.accounts.demoNowOf(orgId)).pipe(
      switchMap((demoNow) =>
        demoNow
          ? new Observable<unknown>((subscriber) =>
              withDemoClock(demoNow, () => next.handle().subscribe(subscriber)),
            )
          : next.handle(),
      ),
    );
  }
}
