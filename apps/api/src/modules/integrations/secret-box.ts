import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * IN-01: Zugangsdaten der Anbindungen, verschlüsselt mit AES-256-GCM. Der Schlüssel kommt aus
 * CONNECTION_SECRET_KEY (im Betrieb aus dem Schlüsseldienst in der EU). Lokal ohne Schlüssel gilt
 * ein zufälliger Schlüssel nur für die Laufzeit des Prozesses (key_ref „ephemeral“). Klartext
 * verlässt diese Datei nur an die Anbieter, nie in Logs, Fehler oder Antworten.
 */
export class SecretBox {
  readonly keyRef: string;
  private readonly key: Buffer;
  private readonly macKey: Buffer;

  constructor(secret: string | undefined) {
    if (secret) {
      this.key = Buffer.from(
        hkdfSync('sha256', secret, 'reziproq', 'reziproq-connection-secret-v1', 32),
      );
      this.keyRef = 'env:v1';
    } else {
      this.key = randomBytes(32);
      this.keyRef = 'ephemeral';
    }
    this.macKey = Buffer.from(hkdfSync('sha256', this.key, 'reziproq', 'reziproq-state-v1', 32));
  }

  /** Signierter, zeitlich begrenzter Wert, z. B. der state einer Anmeldung bei Microsoft */
  sign(payload: Record<string, unknown>, ttlMs: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString(
      'base64url',
    );
    return `${body}.${createHmac('sha256', this.macKey).update(body).digest('base64url')}`;
  }

  /** null, wenn Signatur falsch oder abgelaufen */
  verify(value: string): Record<string, unknown> | null {
    const [body, mac] = value.split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', this.macKey).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      return typeof payload.exp === 'number' && payload.exp > Date.now() ? payload : null;
    } catch {
      return null;
    }
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  /** null, wenn der Schlüssel nicht passt (etwa nach einem Neustart ohne festen Schlüssel). */
  open(ciphertext: string, keyRef: string): string | null {
    if (keyRef !== this.keyRef) return null;
    const [version, iv, tag, data] = ciphertext.split('.');
    if (version !== 'v1' || !iv || !tag || !data) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
