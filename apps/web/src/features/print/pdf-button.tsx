import { FileDownIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { downloadPdf } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';

/**
 * Knopf „Als PDF“ (QS-03): lädt das PDF der Seite vom Server, in der Sprache der Oberfläche. Der
 * Server erzeugt es mit dem, was diese Seite sehen darf.
 */
export function PdfButton({
  path,
  fileName,
  label,
}: {
  /** API-Pfad ohne /api und ohne Abfrage, z. B. /suppliers/<id>/jbp/pdf */
  path: string;
  fileName: string;
  label?: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await downloadPdf(accessToken, path, locale, fileName);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileDownIcon aria-hidden />
        {label ?? t.print.asPdf}
      </Button>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t.print.failed}
        </p>
      )}
    </div>
  );
}
