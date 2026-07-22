import type { ReactNode } from 'react';

export interface HeaderNavItem {
  label: string;
  href: string;
}

export interface HeaderProps {
  nav?: HeaderNavItem[];
  children?: ReactNode;
  authControls?: ReactNode;
}

export function Header({ nav, children, authControls }: HeaderProps) {
  return (
    <header className="site-header" aria-label="Site header">
      <a className="site-header__brand" href="/" aria-label="EngCon ANZ Photography Competition home">
        <img src="/branding/ENGCON Feb 26 Logo RGB horizontal.png" alt="EngCon ANZ" />
      </a>
      <nav className="site-header__nav" aria-label="Primary navigation">
        {children ?? nav?.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
      </nav>
      {authControls && <div className="site-header__auth">{authControls}</div>}
    </header>
  );
}
