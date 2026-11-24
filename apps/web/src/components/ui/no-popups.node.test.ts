import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PLT-10: Seiten statt Fenster. Keine Dialoge, Seitenpanels, Overlays, Toasts oder Popover mit
// Inhalt, auch nicht die von shadcn/ui. Native Auswahllisten bleiben erlaubt. Seit K1-d gibt es
// eine feste Liste erlaubter Überlagerungen (E-K0-01): das Blatt und Frag Reziproq, später die
// Dialoge „So teilen“ und „Agenda freigeben“. Alles andere bleibt verboten.

const src = fileURLToPath(new URL('../../', import.meta.url));

type Rule = [kind: string, pattern: RegExp];

const rules: Rule[] = [
  [
    'Baustein aus components/ui',
    // Das Blatt (components/ui/sheet.tsx) ist seit E-K0-01 erlaubt und darf in jeder Seite stehen.
    /from\s+['"]@\/components\/ui\/(?:dialog|alert-dialog|drawer|toast|sonner|popover|dropdown-menu|hover-card)['"]/,
  ],
  [
    'Radix-Komponente',
    /import\s*\{[^}]*\b(?:Dialog|AlertDialog|Popover|DropdownMenu|HoverCard|Toast)\b[^}]*\}\s*from\s*['"]radix-ui['"]/,
  ],
  ['Bibliothek für Pop-ups', /from\s+['"](?:sonner|vaul|react-hot-toast|react-toastify)['"]/],
  ['natives Dialogfenster', /<dialog\b|\.showModal\(/],
  // Fest positionierte Flächen über der Seite. Der Sprung-Link (focus:fixed) bleibt erlaubt.
  ['fest positioniertes Overlay', /['"`\s](?<![\w:-])fixed(?=[\s'"`])/],
];

/**
 * Stellen, die eine spätere Spec umbaut. Die Liste darf nur schrumpfen: Ein Eintrag, der nichts
 * Verbotenes mehr enthält, lässt den Test ebenfalls scheitern, damit er gestrichen wird.
 */
// Seit UMB-01 leer: Es gibt keine Ausnahmen mehr. Neue Einträge nur mit Spec, die sie abbaut.
const allowed: Record<string, string> = {};

/**
 * E-K0-01: die erlaubten Überlagerungen, je ein Baustein im UI-Paket. Die Liste wächst nur um die
 * Dialoge „So teilen“ (DK-01, K3-d) und „Agenda freigeben“ (BE-01, K3-c).
 */
const overlays: Record<string, string> = {
  'components/ui/sheet.tsx': 'Blatt',
  'components/ui/ask-overlay.tsx': 'Frag Reziproq',
  'components/ui/modal-dialog.ts': 'Grundlage von Blatt und Frag Reziproq',
};
const permittedOverlays = [
  'Blatt',
  'Frag Reziproq',
  'Grundlage von Blatt und Frag Reziproq',
  'So teilen',
  'Agenda freigeben',
];

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
      "import { Drawer } from '@/components/ui/drawer';",
      "import { toast } from '@/components/ui/toast';",
      "import { AlertDialog as A } from 'radix-ui';",
      "import { Popover } from 'radix-ui';",
      "import { Toaster } from 'sonner';",
      "import { Drawer } from 'vaul';",
      '<div className="fixed inset-0 bg-overlay" />',
      '<dialog open className="m-0">',
      'ref.current?.showModal();',
    ];
    for (const sample of samples) expect(findPopups('a.tsx', sample), sample).not.toEqual([]);
    // Erlaubt: die Bausteine aus E-K0-01, native Auswahl, Sprung-Link, sticky Leisten
    expect(findPopups('a.tsx', "import { Sheet } from '@/components/ui/sheet';")).toEqual([]);
    expect(
      findPopups('a.tsx', "import { AskOverlay } from '@/components/ui/ask-overlay';"),
    ).toEqual([]);
    expect(findPopups('a.tsx', '<select className="h-11" />')).toEqual([]);
    expect(findPopups('a.tsx', '<a className="sr-only focus:fixed focus:top-2" />')).toEqual([]);
    expect(findPopups('a.tsx', '<header className="sticky top-0" />')).toEqual([]);
  });

  it('enthält außerhalb der Erlaubnisliste keine Dialoge, Panels, Overlays, Toasts oder Popover', () => {
    const findings = files
      .filter((file) => !(file.path in allowed) && !(file.path in overlays))
      .flatMap((file) => findPopups(file.path, file.text));
    expect(findings, 'Bitte Seiten statt Fenster bauen (README: Seiten statt Fenster)').toEqual([]);
  });

  it('erlaubt nur die Überlagerungen aus E-K0-01, je als Baustein im UI-Paket', () => {
    for (const [path, name] of Object.entries(overlays)) {
      expect(permittedOverlays, path).toContain(name);
      expect(path.startsWith('components/ui/'), path).toBe(true);
      const file = files.find((candidate) => candidate.path === path);
      expect(file, `${path} gibt es nicht mehr`).toBeDefined();
      expect(findPopups(path, file?.text ?? ''), `${path} braucht die Erlaubnis nicht`).not.toEqual(
        [],
      );
    }
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
