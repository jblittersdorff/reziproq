import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { JWK } from 'jose';

export interface UserinfoReply {
  status: number;
  body?: unknown;
}

/**
 * Nachgebautes Zitadel auf einem freien lokalen Port: Discovery-Dokument, Schlüssel und
 * Userinfo-Endpunkt. Jeder Test legt mit `replyUserinfo` fest, was Userinfo antwortet.
 */
export async function startFakeZitadel({ issuer, jwk }: { issuer: string; jwk: JWK }) {
  const userinfoCalls: { authorization: string | undefined }[] = [];
  let replyUserinfo: (accessToken: string) => UserinfoReply = () => ({ status: 401 });
  let baseUrl = '';

  const server = createServer((req, res) => {
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };

    switch (req.url) {
      case '/.well-known/openid-configuration':
        // Der Issuer bleibt der aus der Konfiguration; die Adressen zeigen auf diesen Server.
        return send(200, {
          issuer,
          jwks_uri: `${baseUrl}/oauth/v2/keys`,
          userinfo_endpoint: `${baseUrl}/oidc/v1/userinfo`,
        });
      case '/oauth/v2/keys':
        return send(200, { keys: [jwk] });
      case '/oidc/v1/userinfo': {
        userinfoCalls.push({ authorization: req.headers.authorization });
        const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
        const { status, body } = replyUserinfo(token);
        return send(status, body);
      }
      default:
        return send(404);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    discoveryUrl: `${baseUrl}/.well-known/openid-configuration`,
    userinfoCalls,
    replyUserinfo: (handler: typeof replyUserinfo) => {
      replyUserinfo = handler;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
