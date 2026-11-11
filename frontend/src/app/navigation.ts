import { isNavItemActive, type SidebarNavItem } from '@/components/layout/SidebarNav';
import type { UserRole } from '@/features/auth';
import {
  BanknoteIcon,
  BookIcon,
  ClipboardIcon,
  HomeIcon,
  LayersIcon,
  PhoneIcon,
  ReceiptIcon,
  UserPlusIcon,
  UsersIcon,
} from '@/components/ui/icons';

export interface NavItem extends SidebarNavItem {
  readonly roles: readonly UserRole[];
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

const BOTH: readonly UserRole[] = ['ADMIN', 'LOAN_OFFICER'];

/** Standalone items shown above the groups. */
export const TOP_LEVEL_ITEMS: readonly NavItem[] = [{ to: '/admin', label: 'Dashboard', icon: HomeIcon, roles: ['ADMIN'] }];

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'customers',
    label: 'Customers',
    items: [
      { to: '/customers', label: 'Customers', icon: UsersIcon, roles: BOTH },
      { to: '/collections', label: 'Collections', icon: PhoneIcon, roles: BOTH },
    ],
  },
  {
    id: 'lending',
    label: 'Lending',
    items: [
      { to: '/applications', label: 'Applications', icon: ClipboardIcon, roles: BOTH },
      { to: '/loans', label: 'Loans', icon: BanknoteIcon, roles: BOTH },
      { to: '/invoices', label: 'Invoices', icon: ReceiptIcon, roles: BOTH },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    items: [{ to: '/ledger', label: 'Ledger', icon: BookIcon, roles: ['ADMIN'] }],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { to: '/products', label: 'Loan products', icon: LayersIcon, roles: ['ADMIN'] },
      { to: '/team', label: 'Team', icon: UserPlusIcon, roles: ['ADMIN'] },
    ],
  },
];

export function isItemActive(item: NavItem, pathname: string): boolean {
  return isNavItemActive(item, pathname);
}

/** Only what this role may open; groups with nothing left are dropped. */
export function navigationFor(role: UserRole): { topLevel: readonly NavItem[]; groups: readonly NavGroup[] } {
  return {
    topLevel: TOP_LEVEL_ITEMS.filter((item) => item.roles.includes(role)),
    groups: NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) })).filter((group) => group.items.length > 0),
  };
}
