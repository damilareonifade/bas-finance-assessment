import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { MenuIcon } from '@/components/ui/icons';
import type { SessionUser } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { UserMenu } from './UserMenu';

interface TopBarProps {
  readonly user: SessionUser;
  readonly isDrawerOpen: boolean;
  readonly onToggleDrawer: () => void;
}

/** Light bar over the content. The logo lives in the navy sidebar; on small screens (no sidebar) it shows here instead. */
export function TopBar({ user, isDrawerOpen, onToggleDrawer }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={isDrawerOpen}
          onClick={onToggleDrawer}
          className="grid size-10 place-items-center rounded-lg text-ink hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
        >
          <MenuIcon size={22} />
        </button>
        <Link to="/" aria-label="BAS Finance home" className="flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden">
          <BrandLogo className="h-7" />
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
