import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header, type HeaderNavItem } from './Header';

export interface LayoutProps {
  children: ReactNode;
  nav?: HeaderNavItem[];
  authControls?: ReactNode;
  headerChildren?: ReactNode;
}

export function Layout({ children, nav, authControls, headerChildren }: LayoutProps) {
  return (
    <div className="app-shell">
      <Header nav={nav} authControls={authControls}>{headerChildren}</Header>
      <div className="app-shell__hero" aria-hidden="true" />
      <main className="app-shell__content">{children}</main>
      <Footer />
    </div>
  );
}
