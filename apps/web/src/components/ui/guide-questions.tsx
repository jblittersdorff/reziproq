import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Leitfragen der Designsprache: Fläche mint-soft mit Innenrand mint-line, jede Frage mit
 * Petrol-Ring und Ziffer.
 */
function GuideQuestions({
  title,
  questions,
  headingAs: Heading = 'h2',
  className,
}: {
  title: React.ReactNode;
  questions: React.ReactNode[];
  headingAs?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <section
      data-slot="guide-questions"
      className={cn('flex flex-col gap-4 rounded-lg bg-mint-soft p-6 shadow-inset-mint', className)}
    >
      <Heading className="font-display font-semibold text-lg text-petrol-dark tracking-section-sm">
        {title}
      </Heading>
      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Fragen haben eine feste Reihenfolge
          <li key={index} className="flex gap-3 text-sm leading-normal">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-petrol font-display font-semibold text-chip text-petrol-dark"
            >
              {index + 1}
            </span>
            <span>{question}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { GuideQuestions };
