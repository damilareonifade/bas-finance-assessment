import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon } from '@/components/ui/icons';

export interface Breadcrumb {
  readonly label: string;
  /** Omit for the current page. */
  readonly to?: string;
}

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  /** Where this page sits: Customers › Chidi Okafor › … */
  readonly breadcrumbs?: readonly Breadcrumb[];
  /** Header actions on the right, e.g. a "New customer" button. */
  readonly actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronDownIcon size={14} className="-rotate-90 opacity-60" /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="rounded hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
