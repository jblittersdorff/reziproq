/// <reference types="vite/client" />

// Von vite.config.ts aus der gemeinsamen .env übernommen; leer, wenn nicht gesetzt.
interface ImportMetaEnv {
  readonly ZITADEL_ISSUER: string;
  readonly ZITADEL_CLIENT_ID: string;
  readonly ZITADEL_PROJECT_ID: string;
}
