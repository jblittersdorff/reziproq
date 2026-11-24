import { ArrowRightIcon } from 'lucide-react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { LocalBar } from '@/components/ui/local-bar';
import { useMessages } from '@/lib/i18n';
import { styleguideMessages } from './messages';
import { Subsection } from './parts';

// Beispiel-Adressen zeigen nur auf Abschnitte dieser Seite; die echten Routen baut PLT-11.
const here = '#navigation';

/** Globale Leiste, lokale Leiste und Pfad mit Zurück-Pfeil als Muster (PLT-10). */
export function NavigationSection() {
  const t = useMessages(styleguideMessages);
  const n = t.navigation;

  return (
    <>
      <Subsection
        title={n.localBar}
        description={n.localBarHint}
        files={['src/components/ui/local-bar.tsx']}
      >
        <div className="overflow-hidden rounded-xl shadow-sm">
          <LocalBar
            label={n.localBarLabel}
            name={n.supplier}
            nameHref={here}
            sticky={false}
            activeKey="strategy"
            items={(
              ['overview', 'strategy', 'relationship', 'plan', 'execution', 'impact'] as const
            ).map((key) => ({ key, label: n.areas[key], href: here }))}
            action={
              <Button size="sm">
                {n.nextStep}
                <ArrowRightIcon aria-hidden />
              </Button>
            }
          />
        </div>
      </Subsection>

      <Subsection
        title={n.path}
        description={n.pathHint}
        files={['src/components/ui/breadcrumb.tsx']}
      >
        <Breadcrumb
          label={n.pathLabel}
          backLabel={n.pathBack}
          trail={[{ label: n.settings, href: here }]}
          current={n.organization}
        />
      </Subsection>
    </>
  );
}
