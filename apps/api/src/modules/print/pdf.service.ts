import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { type Browser, chromium } from 'playwright-core';

/**
 * PDF-Baustein (QBR-06): rendert eine Druckseite mit Chromium (Playwright) zu PDF. Das PDF wird
 * direkt ausgeliefert und nirgends gespeichert. Der Browser startet beim ersten PDF und bleibt
 * offen; jede Datei bekommt eine eigene, leere Seite ohne Netzwerkzugriff.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private browser: Promise<Browser> | null = null;

  private launch(): Promise<Browser> {
    if (!this.browser) {
      this.browser = chromium.launch({ headless: true }).catch((error: unknown) => {
        this.browser = null;
        throw error;
      });
    }
    return this.browser;
  }

  async render(html: string): Promise<Buffer> {
    const browser = await this.launch();
    // Kein Netz: Die Seite bringt Tokens und Schriften selbst mit (print-assets).
    const context = await browser.newContext({ offline: true });
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      // Als Text: Die API kennt die Typen des Browsers (DOM) nicht.
      await page.evaluate('document.fonts.ready.then(() => true)');
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy() {
    const browser = this.browser;
    this.browser = null;
    if (browser) await (await browser).close();
  }
}
