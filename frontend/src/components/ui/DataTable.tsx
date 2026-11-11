import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DataTableColumn<TRow> {
  readonly key: string;
  readonly header: string;
  readonly align?: 'left' | 'right';
  readonly render: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow> {
  readonly caption: string;
  readonly columns: ReadonlyArray<DataTableColumn<TRow>>;
  readonly rows: readonly TRow[];
  readonly getRowKey: (row: TRow, index: number) => string;
  readonly emptyMessage?: string;
  /** Richer empty state (title, help, "New …" action). Wins over `emptyMessage`. */
  readonly emptyState?: ReactNode;
  readonly footer?: ReactNode;
  /** Makes the whole row open the record. Keep a real link in the first column for keyboard users. */
  readonly onRowClick?: (row: TRow) => void;
}

export function DataTable<TRow>({ caption, columns, rows, getRowKey, emptyMessage = 'Nothing to show yet.', emptyState, footer, onRowClick }: DataTableProps<TRow>) {
  if (rows.length === 0) return emptyState ? <>{emptyState}</> : <p className="py-6 text-center text-sm text-ink-muted">{emptyMessage}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-ink-muted">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('px-3 py-2 font-medium', column.align === 'right' ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={getRowKey(row, rowIndex)}
              onClick={
                onRowClick
                  ? (event) => {
                      // let real links / buttons inside the row do their own thing
                      if ((event.target as HTMLElement).closest('a,button,input,select')) return;
                      onRowClick(row);
                    }
                  : undefined
              }
              className={cn('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-canvas')}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-3 py-2', column.align === 'right' ? 'text-right tabular-nums' : 'text-left')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot className="border-t border-line">{footer}</tfoot> : null}
      </table>
    </div>
  );
}
