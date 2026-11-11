import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { CloseIcon } from '@/components/ui/icons';

interface SidebarLayoutProps {
  /** Where the logo links to. */
  readonly homeTo: string;
  /** The sidebar's contents; `onNavigate` closes the mobile drawer after a link is followed. */
  readonly renderSidebar: (onNavigate?: () => void) => ReactNode;
  /** The light bar over the content; it owns the button that opens the drawer on small screens. */
  readonly renderTopBar: (drawer: { readonly isOpen: boolean; readonly toggle: () => void }) => ReactNode;
  readonly children: ReactNode;
}

/** Navy sidebar (logo + navigation, full height) beside a light content column (topbar + page); a drawer on small screens. */
export function SidebarLayout({ homeTo, renderSidebar, renderTopBar, children }: SidebarLayoutProps) {
  const { pathname } = useLocation();
  // The drawer remembers the page it was opened on, so navigating anywhere closes it without an effect.
  const [drawerOpenedOn, setDrawerOpenedOn] = useState<string | null>(null);
  const isDrawerOpen = drawerOpenedOn === pathname;
  const setIsDrawerOpen = (isOpen: boolean) => setDrawerOpenedOn(isOpen ? pathname : null);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpenedOn(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isDrawerOpen]);

  const sidebarLogo = (
    <Link to={homeTo} aria-label="BAS Finance home" className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-surface">
      <BrandLogo variant="reversed" className="h-8" />
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
        <div className="flex h-20 items-center px-7">{sidebarLogo}</div>
        {renderSidebar()}
      </aside>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink/40" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-sidebar shadow-xl">
            <div className="flex h-20 items-center justify-between px-6">
              {sidebarLogo}
              <button type="button" aria-label="Close navigation" onClick={() => setIsDrawerOpen(false)} className="grid size-10 place-items-center rounded-lg text-sidebar-ink hover:bg-sidebar-hover hover:text-surface">
                <CloseIcon size={22} />
              </button>
            </div>
            {renderSidebar(() => setIsDrawerOpen(false))}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {renderTopBar({ isOpen: isDrawerOpen, toggle: () => setIsDrawerOpen(!isDrawerOpen) })}
        <main className="px-4 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
