import type * as React from 'react';

import { useMessages } from '@/lib/i18n';
import { styleguideMessages } from './messages';

/** Abschnitt der Seite mit Überschrift, Ziel der Sprungnavigation */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-8">
      <h2 id={`${id}-title`} className="font-semibold text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Unterabschnitt, z. B. ein einzelner Baustein */
export function Subsection({
  title,
  description,
  files,
  children,
}: {
  title: string;
  description?: string;
  files?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
        {files && <SourceFiles files={files} />}
      </div>
      {children}
    </div>
  );
}

/** Zeigt, aus welcher Datei ein Baustein kommt, damit man ihn wiederverwendet statt neu baut. */
export function SourceFiles({ files }: { files: string[] }) {
  const t = useMessages(styleguideMessages);
  return (
    <p className="flex flex-wrap gap-x-2 text-muted-foreground text-sm" data-slot="source-files">
      <span>{t.source}</span>
      {files.map((file) => (
        <code key={file} className="text-foreground">
          apps/web/{file}
        </code>
      ))}
    </p>
  );
}
