import { useState, type ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDownIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils/cn';

export interface SidebarNavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ComponentType<{ size?: number }>;
  /** Light up only on this exact path (for a home item whose path prefixes every other one, e.g. /portal). */
  readonly exact?: boolean;
  /** Paths that belong to a sibling item and must not light this one up (e.g. /loans/new under Loans). */
  readonly excludePaths?: readonly string[];
}

export interface SidebarNavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly SidebarNavItem[];
}

export function isNavItemActive(item: SidebarNavItem, pathname: string): boolean {
  const matches = (path: string) => pathname === path || (!item.exact && pathname.startsWith(`${path}/`));
  return matches(item.to) && !(item.excludePaths ?? []).some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

interface SidebarNavProps {
  readonly topLevel: readonly SidebarNavItem[];
  readonly groups: readonly SidebarNavGroup[];
  readonly ariaLabel?: string;
  /** Called after a link is followed — the mobile drawer uses it to close itself. */
  readonly onNavigate?: () => void;
}

interface SidebarLinkProps {
  readonly item: SidebarNavItem;
  readonly isActive: boolean;
  readonly onNavigate?: () => void;
}

function SidebarLink({ item, isActive, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-surface',
        isActive ? 'bg-sidebar-active text-surface shadow-sm' : 'text-sidebar-ink hover:bg-sidebar-hover hover:text-surface',
      )}
    >
      <Icon size={20} />
      {item.label}
    </Link>
  );
}

/** The navy sidebar's links: standalone items, then collapsible groups. Shared by the staff app and the customer portal. */
export function SidebarNav({ topLevel, groups, ariaLabel = 'Main', onNavigate }: SidebarNavProps) {
  const { pathname } = useLocation();
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<ReadonlySet<string>>(new Set());

  const toggleGroup = (groupId: string) =>
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-6 px-4 pt-2 pb-6">
      {topLevel.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {topLevel.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} isActive={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      ) : null}

      {groups.map((group) => {
        const isOpen = !collapsedGroupIds.has(group.id);
        const panelId = `nav-group-${group.id}`;
        return (
          <section key={group.id}>
            <h2 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-sidebar-ink/70 hover:text-surface focus-visible:outline-2 focus-visible:outline-surface"
              >
                {group.label}
                <ChevronDownIcon size={16} className={cn('transition-transform', isOpen ? '' : '-rotate-90')} />
              </button>
            </h2>
            <ul id={panelId} hidden={!isOpen} className="mt-1 flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} isActive={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
