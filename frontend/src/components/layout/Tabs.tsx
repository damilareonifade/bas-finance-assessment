import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';

export interface TabLink {
  readonly id: string;
  readonly to: string;
  readonly label: string;
}

interface TabsProps {
  readonly tabs: readonly TabLink[];
  /** The page decides which tab is current (tabs may differ only by query string, which NavLink cannot tell apart). */
  readonly activeId: string;
  readonly label: string;
}

/** Sub-pages of one screen (Overview / Statement, Members / Invitations), as links so each has its own URL. */
export function Tabs({ tabs, activeId, label }: TabsProps) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand',
              isActive ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
