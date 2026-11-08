import type * as React from 'react';

/**
 * Wie ein Navigations-Baustein Links zeichnet. Standard ist ein normales `<a>`; der App-Rahmen
 * (PLT-11) gibt hier den Link des Routers hinein. So bleiben die Bausteine ohne Routen nutzbar.
 */
export type RenderLink = (props: {
  href: string;
  className: string;
  'aria-current'?: React.AriaAttributes['aria-current'];
  'aria-label'?: string | undefined;
  children: React.ReactNode;
}) => React.ReactNode;

export const defaultRenderLink: RenderLink = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);

export interface NavItem {
  key: string;
  label: string;
  href: string;
}
