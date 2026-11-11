import { Badge } from '@/components/ui/Badge';
import type { Invoice } from '../schemas/invoice';

interface InvoiceStatusBadgeProps {
  readonly invoice: Pick<Invoice, 'status' | 'dueDate'>;
  /** YYYY-MM-DD */
  readonly today: string;
}

export function InvoiceStatusBadge({ invoice, today }: InvoiceStatusBadgeProps) {
  if (invoice.status === 'SETTLED') return <Badge tone="success">Settled</Badge>;
  return invoice.dueDate < today ? <Badge tone="danger">Overdue</Badge> : <Badge tone="neutral">Awaiting settlement</Badge>;
}
