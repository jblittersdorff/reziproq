import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PLT-10: Seiten statt Fenster. Keine Dialoge, Seitenpanels, Overlays, Toasts oder Popover mit
// Inhalt, auch nicht die von shadcn/ui. Native Auswahllisten bleiben erlaubt.

const src = fileURLToPath(new URL('../../', import.meta.url));

type Rule = [kind: string, pattern: RegExp];

const rules: Rule[] = [
  [
    'Baustein aus components/ui',
    /from\s+['"]@\/components\/ui\/(?:dialog|alert-dialog|sheet|drawer|toast|sonner|popover|dropdown-menu|hover-card)['"]/,
  ],
  [
    'Radix-Komponente',
    /import\s*\{[^}]*\b(?:Dialog|AlertDialog|Popover|DropdownMenu|HoverCard|Toast)\b[^}]*\}\s*from\s*['"]radix-ui['"]/,
  ],
  ['Bibliothek für Pop-ups', /from\s+['"](?:sonner|vaul|react-hot-toast|react-toastify)['"]/],
  // Fest positionierte Flächen über der Seite. Der Sprung-Link (focus:fixed) bleibt erlaubt.
  ['fest positioniertes Overlay', /['"`\s](?<![\w:-])fixed(?=[\s'"`])/],
];

/**
 * Stellen, die eine spätere Spec umbaut. Die Liste darf nur schrumpfen: Ein Eintrag, der nichts
 * Verbotenes mehr enthält, lässt den Test ebenfalls scheitern, damit er gestrichen wird.
 */
const allowed: Record<string, string> = {
  'components/ui/dialog.tsx': 'entfällt mit PLT-12 und UMB-01, sobald niemand ihn mehr nutzt',
  'components/ui/sheet.tsx': 'entfällt mit PLT-11 (Menü als eigene Seite)',
  'components/ui/dropdown-menu.tsx': 'entfällt mit PLT-11 (Seite /profil)',
  'features/shell/app-layout.tsx': 'PLT-11: globale Leiste statt Seitenleiste mit Sheet',
  'features/shell/user-menu.tsx': 'PLT-11: Seite /profil statt Nutzer-Menü',
  'features/prompt/prompt-dialog.tsx': 'PLT-12: Seite /fragen statt Fenster',
  'features/support/customer-dialog.tsx': 'UMB-01: Seite /betreiber/kunden statt Fenster',
  'features/auth/reauth-notice.tsx': 'UMB-02: Rückmeldezeile im Seitenfluss statt Overlay',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Alle Fundstellen als „Datei:Zeile Art“. */
function findPopups(file: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      rules
        .filter(([, pattern]) => pattern.test(line))
        .map(([kind]) => `${file}:${index + 1} ${kind}`),
    );
}

describe('Keine Pop-ups (PLT-10)', () => {
  const files = sourceFiles(src).map((file) => ({
    path: relative(src, file),
    text: readFileSync(file, 'utf8'),
  }));

  it('Ein Test schlägt fehl, wenn eine verbotene Komponente im Code vorkommt', () => {
    const samples = [
      "import { Dialog } from '@/components/ui/dialog';",
      "import { Sheet, SheetContent } from '@/components/ui/sheet';",
      "import { toast } from '@/components/ui/toast';",
      "import { AlertDialog as A } from 'radix-ui';",
      "import { Popover } from 'radix-ui';",
      "import { Toaster } from 'sonner';",
      "import { Drawer } from 'vaul';",
      '<div className="fixed inset-0 bg-overlay" />',
    ];
    for (const sample of samples) expect(findPopups('a.tsx', sample), sample).not.toEqual([]);
    // Erlaubt: native Auswahl, Sprung-Link, sticky Leisten
    expect(findPopups('a.tsx', '<select className="h-11" />')).toEqual([]);
    expect(findPopups('a.tsx', '<a className="sr-only focus:fixed focus:top-2" />')).toEqual([]);
    expect(findPopups('a.tsx', '<header className="sticky top-0" />')).toEqual([]);
  });

  it('enthält außerhalb der Erlaubnisliste keine Dialoge, Panels, Overlays, Toasts oder Popover', () => {
    const findings = files
      .filter((file) => !(file.path in allowed))
      .flatMap((file) => findPopups(file.path, file.text));
    expect(findings, 'Bitte Seiten statt Fenster bauen (README: Seiten statt Fenster)').toEqual([]);
  });

  it.each(Object.entries(allowed))(
    'die Erlaubnis für %s wird noch gebraucht (sonst streichen: %s)',
    (path) => {
      const file = files.find((candidate) => candidate.path === path);
      expect(file, `${path} gibt es nicht mehr`).toBeDefined();
      expect(findPopups(path, file?.text ?? '')).not.toEqual([]);
    },
  );
});
