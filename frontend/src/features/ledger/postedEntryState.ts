import type { JournalEntry } from './schemas/ledger';

/** Carried through navigation so the record page can show the entry that was just posted (disbursement, advance). */
export interface PostedEntryState {
  readonly postedJournalEntry: JournalEntry;
}

export function readPostedEntry(state: unknown): JournalEntry | null {
  if (typeof state !== 'object' || state === null || !('postedJournalEntry' in state)) return null;
  return (state as PostedEntryState).postedJournalEntry;
}
