import { Link, Outlet } from 'react-router-dom';
import { SidebarLayout } from '@/components/layout/SidebarLayout';
import { SidebarNav, type SidebarNavGroup, type SidebarNavItem } from '@/components/layout/SidebarNav';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BanknoteIcon, ClipboardIcon, FileTextIcon, HomeIcon, MenuIcon, PlusCircleIcon, ReceiptIcon } from '@/components/ui/icons';
import { initialsOf } from '@/lib/utils/initials';
import { usePortalOverviewQuery } from '../api/portalApi';
import { PortalNotifications } from './PortalNotifications';
import { PortalUserMenu } from './PortalUserMenu';
import { useCurrentCustomer } from './RequirePortalAuth';

const TOP_LEVEL: readonly SidebarNavItem[] = [{ to: '/portal', label: 'Overview', icon: HomeIcon, exact: true }];

const GROUPS: readonly SidebarNavGroup[] = [
  {
    id: 'borrowing',
    label: 'Borrowing',
    items: [
      { to: '/portal/loans', label: 'My loans', icon: BanknoteIcon },
      { to: '/portal/invoices', label: 'My invoices', icon: ReceiptIcon },
      { to: '/portal/applications', label: 'Applications', icon: ClipboardIcon },
      { to: '/portal/apply', label: 'Apply for a loan', icon: PlusCircleIcon },
    ],
  },
  { id: 'account', label: 'Account', items: [{ to: '/portal/documents', label: 'Documents', icon: FileTextIcon }] },
];

/** Pinned to the bottom of the sidebar so the customer always knows who to call. */
function SidebarOfficer() {
  const officer = usePortalOverviewQuery().data?.officer;
  if (!officer) return null;
  return (
    <div className="mx-4 mt-auto mb-6 rounded-lg bg-sidebar-hover p-3">
      <p className="text-xs text-sidebar-ink/70">Your loan officer</p>
      <div className="mt-2 flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-xs font-semibold text-surface">
          {initialsOf(officer.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-surface">{officer.fullName}</p>
          <a href={`mailto:${officer.email}`} className="block truncate text-xs text-sidebar-ink hover:text-surface hover:underline">
            {officer.email}
          </a>
        </div>
      </div>
    </div>
  );
}

/** The customer's own space, in the same shell as the staff app: navy sidebar, light topbar with the bell and account menu. */
export function PortalLayout() {
  const customer = useCurrentCustomer();
  return (
    <SidebarLayout
      homeTo="/portal"
      renderSidebar={(onNavigate) => (
        <>
          <SidebarNav ariaLabel="Portal" topLevel={TOP_LEVEL} groups={GROUPS} onNavigate={onNavigate} />
          <SidebarOfficer />
        </>
      )}
      renderTopBar={(drawer) => (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={drawer.isOpen}
              onClick={drawer.toggle}
              className="grid size-10 place-items-center rounded-lg text-ink hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
            >
              <MenuIcon size={22} />
            </button>
            <Link to="/portal" aria-label="BAS Finance home" className="flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden">
              <BrandLogo className="h-7" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <PortalNotifications />
            <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
            <PortalUserMenu customer={customer} />
          </div>
        </header>
      )}
    >
      <Outlet />
    </SidebarLayout>
  );
}
