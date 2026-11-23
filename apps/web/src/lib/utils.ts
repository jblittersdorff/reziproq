import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge muss die eigenen Stufen aus styles/tokens.css kennen. Sonst hält es z. B.
// text-chip für eine Textfarbe und verwirft es neben text-muted-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'chip',
        'micro',
        'section',
        'figure',
        'title-work',
        'title',
        'title-hero',
        'bar-name',
        'display',
        'insight',
        'evidence',
        // WEB-01: Stufen der Website
        'site-hero',
        'site-title',
        'site-lead',
        'site-figure',
      ],
      shadow: [
        'card',
        'ask',
        'toggle',
        'inset-line',
        'inset-mint',
        'ring-gap',
        'ring-gap-paper',
        'site-frame',
      ],
      radius: ['field', 'site', 'site-lg'],
      tracking: ['title', 'title-lg', 'title-work', 'section', 'section-sm', 'site-hero'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
