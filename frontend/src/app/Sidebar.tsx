import { SidebarNav } from '@/components/layout/SidebarNav';
import type { UserRole } from '@/features/auth';
import { navigationFor } from './navigation';

interface SidebarProps {
  readonly role: UserRole;
  /** Called after a link is followed — the mobile drawer uses it to close itself. */
  readonly onNavigate?: () => void;
}

/** Every staff destination this role may open, grouped and collapsible. */
export function Sidebar({ role, onNavigate }: SidebarProps) {
  const { topLevel, groups } = navigationFor(role);
  return <SidebarNav topLevel={topLevel} groups={groups} onNavigate={onNavigate} />;
}
