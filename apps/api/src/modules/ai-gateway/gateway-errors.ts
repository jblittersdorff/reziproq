import { ConflictException, ForbiddenException } from '@nestjs/common';

/** Monatsbudget erreicht: kein neuer Aufruf, bis der Monat wechselt oder der Admin erhöht. */
export class BudgetExhaustedError extends ConflictException {
  constructor() {
    super({
      statusCode: 409,
      code: 'ki_kontingent_erschoepft',
      message: 'Das KI-Budget dieses Monats ist erreicht.',
    });
  }
}

/** Aufruf außerhalb der EU: abgelehnt und in model_call protokolliert. */
export class RegionRejectedError extends ForbiddenException {
  constructor(region: string) {
    super({
      statusCode: 403,
      code: 'ki_region_abgelehnt',
      message: `Modellaufrufe außerhalb der EU sind nicht erlaubt (${region}).`,
    });
  }
}

/** MA-01 (K1-f): Die Aufgabe ist in den KI-Einstellungen aus; kein Aufruf, kein Lauf (T1-MA4). */
export class WorkerDisabledError extends ConflictException {
  constructor(worker: string) {
    super({
      statusCode: 409,
      code: 'ki_aufgabe_aus',
      message: 'Diese Aufgabe von Reziproq ist in den KI-Einstellungen ausgeschaltet.',
      aufgabe: worker,
    });
  }
}
