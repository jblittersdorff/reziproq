import type { ComponentType } from 'react';
import { SiteLayout } from './components/layout';
import { SiteProvider } from './i18n';
import { CompanyPage } from './pages/company';
import { ContactPage } from './pages/contact';
import { HomePage } from './pages/home';
import { HowItWorksPage } from './pages/how-it-works';
import { LegalPage } from './pages/legal';
import { LoginPage } from './pages/login';
import { PilotPage } from './pages/pilot';
import { PlatformPage } from './pages/platform';
import { PricingPage } from './pages/pricing';
import { SecurityPage } from './pages/security';
import { SuppliersPage } from './pages/suppliers';
import type { Locale, PageKey } from './site';

// WEB-01: jede Seite ist eine Komponente ohne Props.
export const pageComponents: Record<PageKey, ComponentType> = {
  home: HomePage,
  howItWorks: HowItWorksPage,
  platform: PlatformPage,
  suppliers: SuppliersPage,
  security: SecurityPage,
  pricing: PricingPage,
  pilot: PilotPage,
  company: CompanyPage,
  contact: ContactPage,
  login: LoginPage,
  legal: LegalPage,
};

export function App({ page, locale }: { page: PageKey; locale: Locale }) {
  const Page = pageComponents[page];
  return (
    <SiteProvider locale={locale} page={page}>
      <SiteLayout>
        <Page />
      </SiteLayout>
    </SiteProvider>
  );
}
