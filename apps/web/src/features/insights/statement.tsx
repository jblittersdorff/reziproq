import type { InsightStatement } from '@reziproq/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InsightHeading } from '@/components/ui/insight';
import { useToken } from '@/features/ratings/use-rating';
import { reportStatement } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Aussage von Reziproq (AW-01): nur wenn sie die Prüfung gegen die Fakten bestanden hat; sonst
 * steht nichts und die Seite zeigt nur den Beleg. „Stimmt nicht“ meldet sie.
 */
export function Statement({ statement }: { statement: InsightStatement | null | undefined }) {
  const text = useT().insights;
  const accessToken = useToken();
  const [reported, setReported] = useState(false);
  if (!statement) return null;
  return (
    <InsightHeading
      attribution={text.summarized}
      headline={statement.headline}
      explanation={statement.body}
      sources={statement.sources.map((source) => ({
        key: source.key,
        label: source.label,
        ...(source.href ? { href: source.href } : {}),
      }))}
      action={
        reported ? (
          <span role="status" className="self-center text-muted-foreground text-sm">
            {text.reported}
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await reportStatement(accessToken, statement.id);
              setReported(true);
            }}
          >
            {text.report}
          </Button>
        )
      }
    />
  );
}
