import { Inject, Injectable } from '@nestjs/common';

export const RATE_LIMIT = Symbol('RATE_LIMIT');

export interface RateLimitOptions {
  perMinute: number;
  now?: () => number;
}

/**
 * Begrenzt die Anfragen je Nutzer und Minute (PLT-12). Der Speicher liegt im Prozess; bei mehreren
 * API-Instanzen gilt die Grenze je Instanz. Für den Betrieb auf AWS kommt ein gemeinsamer Speicher.
 */
@Injectable()
export class RateLimiter {
  private readonly requests = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(@Inject(RATE_LIMIT) private readonly options: RateLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  /** true, wenn die Anfrage erlaubt ist; zählt sie dann mit. */
  tryAcquire(userId: string): boolean {
    const now = this.now();
    const recent = (this.requests.get(userId) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= this.options.perMinute) {
      this.requests.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.requests.set(userId, recent);
    return true;
  }
}
