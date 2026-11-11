import type { QuoteFreshness } from '@/lib/utils/useLiveQuote';

const HINTS: Readonly<Record<Exclude<QuoteFreshness, 'current'>, string>> = {
  updating: 'Updating the quote for your changes…',
  'needs-fixing': 'Fix the highlighted fields to update the quote.',
};

interface QuoteFreshnessNoteProps {
  readonly freshness: QuoteFreshness;
}

/** Beside the approve button: why it is disabled while the quote catches up with the form. */
export function QuoteFreshnessNote({ freshness }: QuoteFreshnessNoteProps) {
  if (freshness === 'current') return null;
  return (
    <p role="status" className="text-sm text-ink-muted">
      {HINTS[freshness]}
    </p>
  );
}
