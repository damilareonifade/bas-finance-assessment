import type { ReactNode } from 'react';

interface FormSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** A titled block of fields inside a form, so long forms read as a few small questions. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      <header className="border-b border-line px-6 py-4">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </header>
      <div className="grid gap-5 p-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}
