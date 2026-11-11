import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettledValue } from './useSettledValue';

/**
 * current — the figures are the server's quote for exactly what the form holds now.
 * updating — the form changed; a fresh quote is on its way.
 * needs-fixing — the form changed and is not valid (or the server refused it), so there is nothing to approve.
 */
export type QuoteFreshness = 'current' | 'updating' | 'needs-fixing';

/** The parts of a TanStack quote mutation this hook needs. */
export interface QuoteMutationLike<TRequest, TQuote> {
  readonly mutate: (request: TRequest, options: { onSuccess: (quote: TQuote) => void }) => void;
  readonly isError: boolean;
  readonly variables: TRequest | undefined;
}

interface LiveQuoteOptions {
  /** Runs before every quote request (e.g. clear a failed posting). */
  readonly onQuoteRequested?: () => void;
  /** Runs when a new quote arrives — new inputs are a new intent, so this is where a new idempotency key is made. */
  readonly onNewQuote?: () => void;
  readonly delayMs?: number;
}

/** Two requests with the same key would get the same quote. */
const requestKey = (request: unknown): string => JSON.stringify(request);

/**
 * Quote → (edit → re-quote automatically once typing pauses) → approve. Nothing is quoted until the first explicit
 * request; after that every valid change is re-quoted. `quoted` pairs the server's quote with exactly the request it was
 * for — that pair is what gets posted — and `freshness` says whether it still matches the form.
 */
export function useLiveQuote<TRequest, TQuote>(quoteMutation: QuoteMutationLike<TRequest, TQuote>, options: LiveQuoteOptions = {}) {
  const { delayMs = 400 } = options;
  const [quoted, setQuoted] = useState<{ readonly request: TRequest; readonly quote: TQuote } | null>(null);
  const [draft, setDraft] = useState<TRequest | null>(null);
  const settledDraft = useSettledValue(draft, delayMs);
  const lastRequestedKeyRef = useRef<string | null>(null);
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  const { mutate } = quoteMutation;
  const requestQuote = useCallback(
    (request: TRequest) => {
      lastRequestedKeyRef.current = requestKey(request);
      callbacksRef.current.onQuoteRequested?.();
      // TanStack only fires the latest call's onSuccess, so a slow, older response can never overwrite a newer quote.
      mutate(request, {
        onSuccess: (quote) => {
          callbacksRef.current.onNewQuote?.();
          setQuoted({ request, quote });
        },
      });
    },
    [mutate],
  );

  const hasQuote = quoted !== null;
  useEffect(() => {
    if (!hasQuote || settledDraft === null || requestKey(settledDraft) === lastRequestedKeyRef.current) return;
    requestQuote(settledDraft);
  }, [hasQuote, settledDraft, requestQuote]);

  const failedRequest = quoteMutation.isError ? quoteMutation.variables : undefined;
  let freshness: QuoteFreshness = 'updating';
  if (draft === null) freshness = 'needs-fixing';
  else if (quoted !== null && requestKey(draft) === requestKey(quoted.request)) freshness = 'current';
  else if (failedRequest !== undefined && requestKey(failedRequest) === requestKey(draft)) freshness = 'needs-fixing';

  return { quoted, freshness, requestQuote, setDraft } as const;
}
