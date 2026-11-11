import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, LogOutIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils/cn';
import { initialsOf } from '@/lib/utils/initials';
import { usePortalLogoutMutation } from '../api/portalApi';
import type { PortalCustomer } from '../schemas/portal';

interface PortalUserMenuProps {
  readonly customer: PortalCustomer;
}

/** Account menu in the portal topbar: who is signed in, and Sign out. Same look as the staff menu. */
export function PortalUserMenu({ customer }: PortalUserMenuProps) {
  const navigate = useNavigate();
  const logout = usePortalLogoutMutation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-surface">{initialsOf(customer.fullName)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium text-ink">{customer.fullName}</span>
          <span className="block text-xs leading-tight text-ink-muted">Customer</span>
        </span>
        <ChevronDownIcon size={16} className={cn('text-ink-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div id={menuId} role="menu" aria-label="Account" className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink">{customer.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{customer.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/portal/login', { replace: true }) })}
            disabled={logout.isPending}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
          >
            <LogOutIcon size={18} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
