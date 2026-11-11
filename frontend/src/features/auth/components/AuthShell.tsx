import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface AuthShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}

/** Shared frame for the signed-out screens: soft sky backdrop, centred card, BAS logo. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-deep via-sky to-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-9" />
          <div>
            <h1 className="text-2xl font-semibold text-brand-strong">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
