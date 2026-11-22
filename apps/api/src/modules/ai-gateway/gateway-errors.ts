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
