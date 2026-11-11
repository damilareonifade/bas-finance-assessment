import { Outlet } from 'react-router-dom';
import { SidebarLayout } from '@/components/layout/SidebarLayout';
import { useCurrentUser } from '@/features/auth';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Staff shell: navy sidebar (logo + navigation, full height) beside a light content column (topbar + page). */
export function AppLayout() {
  const user = useCurrentUser();
  return (
    <SidebarLayout
      homeTo="/"
      renderSidebar={(onNavigate) => <Sidebar role={user.role} onNavigate={onNavigate} />}
      renderTopBar={(drawer) => <TopBar user={user} isDrawerOpen={drawer.isOpen} onToggleDrawer={drawer.toggle} />}
    >
      <Outlet />
    </SidebarLayout>
  );
}
