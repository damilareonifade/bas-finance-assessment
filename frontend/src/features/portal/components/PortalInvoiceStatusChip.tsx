import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import type { PortalInvoice } from '../schemas/portal';

const LABELS: Readonly<Record<PortalInvoice['status'], { label: string; tone: StatusTone }>> = {
  OPEN: { label: 'Awaiting payment', tone: 'progress' },
  OVERDUE: { label: 'Overdue', tone: 'alert' },
  SETTLED: { label: 'Settled', tone: 'complete' },
};

interface PortalInvoiceStatusChipProps {
  readonly status: PortalInvoice['status'];
}

export function PortalInvoiceStatusChip({ status }: PortalInvoiceStatusChipProps) {
  const { label, tone } = LABELS[status];
  return <StatusChip tone={tone}>{label}</StatusChip>;
}
