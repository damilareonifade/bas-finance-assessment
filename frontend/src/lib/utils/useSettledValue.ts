import { useEffect, useState } from 'react';

/** Follows `value`, but only once it has stopped changing for `delayMs` — so a live quote waits until typing pauses. */
export function useSettledValue<TValue>(value: TValue, delayMs = 350): TValue {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
