import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { SearchIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils/cn';
import { useSettledValue } from '@/lib/utils/useSettledValue';
import { useLedgerSearchQuery } from '../api/ledgerBookApi';
import type { LedgerSearchResult } from '../schemas/ledgerBook';

interface LedgerCustomerSearchProps {
  readonly onSelect: (result: LedgerSearchResult) => void;
}

/**
 * Type a name, customer id, email, phone — or a loan / invoice / journal entry id — and pick the customer.
 * A combobox: arrow keys move, Enter picks, Escape closes.
 */
export function LedgerCustomerSearch({ onSelect }: LedgerCustomerSearchProps) {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const settledText = useSettledValue(text, 250);
  const searchQuery = useLedgerSearchQuery(settledText);
  const results = settledText.trim() ? (searchQuery.data ?? []) : [];
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const choose = (result: LedgerSearchResult) => {
    onSelect(result);
    setText('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const result = results[activeIndex];
      if (isOpen && result) {
        event.preventDefault();
        choose(result);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const showPanel = isOpen && text.trim().length > 0;
  const isSearching = text.trim() !== settledText.trim() || searchQuery.isFetching;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium text-ink">
        Customer
      </label>
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[activeIndex] ? `${listId}-${results[activeIndex].customerId}` : undefined}
          autoComplete="off"
          placeholder="Name, CUS- id, email, phone, or a LN- / INV- / JE- reference"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-10 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-2 focus:outline-brand/20"
        />
      </div>
      {showPanel ? (
        <ul id={listId} role="listbox" aria-label="Matching customers" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-muted">{isSearching ? 'Searching…' : 'No customer matches that.'}</li>
          ) : (
            results.map((result, index) => (
              <li
                key={result.customerId}
                id={`${listId}-${result.customerId}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn('cursor-pointer rounded-lg px-3 py-2', index === activeIndex ? 'bg-brand-soft' : 'hover:bg-line/40')}
              >
                <p className="text-sm font-medium text-ink">
                  {result.fullName} <span className="font-normal text-ink-muted">· {result.customerId}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {[result.matchedOn ? `Matched on ${result.matchedOn}` : null, result.email, result.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
