import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { systemTime } from '@reziproq/db';
import { decodeProtectedHeader, type JWTPayload, jwtVerify, SignJWT } from 'jose';
import { env } from '../../config/env.js';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person ohne Zitadel. Die API stellt für eine Person
// eines Demo-Mandanten ein eigenes Token aus. Der Schlüssel entsteht beim Start im Speicher und
// endet mit dem Prozess; nichts davon steht im Repo oder in der .env. Zitadel-Tokens sind
// asymmetrisch signiert (RS256, ES256, EdDSA), Demo-Tokens symmetrisch (HS256): Beide Wege lassen
// sich nicht verwechseln. Der Wächter nimmt ein Demo-Token nur für einen Demo-Mandanten an.

export const demoIssuer = 'reziproq-demo';
/** Eine Vorführung, kein Arbeitstag: nach zwölf Stunden neu anmelden */
const demoHours = 12;

/** Demo-Sitzungen nur mit Schalter in der lokalen Konfiguration und nie im Betrieb */
export function demoSessionsEnabled(): boolean {
  return env.DEMO_SESSIONS === 'true' && env.NODE_ENV !== 'production';
}

@Injectable()
export class DemoTokens {
  private readonly secret = new Uint8Array(randomBytes(32));

  /** Token für eine Person; ob sie zu einem Demo-Mandanten gehört, prüft der Aufrufer. */
  async issue(userId: string): Promise<{ token: string; expiresAt: Date }> {
    // Echtzeit: Tokens sind Technik, nicht Fachzeit (DM-01, Uhr)
    const now = systemTime();
    const expiresAt = new Date(now.getTime() + demoHours * 3_600_000);
    const token = await new SignJWT({ demo: true })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(demoIssuer)
      .setAudience(demoIssuer)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secret);
    return { token, expiresAt };
  }

  /** Ist das ein Demo-Token (symmetrisch signiert)? Ohne lesbaren Kopf nicht. */
  isDemoToken(token: string): boolean {
    try {
      return decodeProtectedHeader(token).alg === 'HS256';
    } catch {
      return false;
    }
  }

  /** Prüft Signatur, Issuer, Audience, Ablauf und sub; jeder Fehler wirft (JOSEError). */
  async verify(token: string): Promise<JWTPayload & { sub: string }> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: demoIssuer,
      audience: demoIssuer,
      algorithms: ['HS256'],
      requiredClaims: ['sub'],
    });
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('sub fehlt');
    return { ...payload, sub: payload.sub };
  }
}
