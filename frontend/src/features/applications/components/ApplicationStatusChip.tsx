import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '../schemas/application';

const TONE: Readonly<Record<ApplicationStatus, StatusTone>> = {
  SUBMITTED: 'waiting',
  UNDER_REVIEW: 'progress',
  APPROVED: 'good',
  REJECTED: 'alert',
};

export function ApplicationStatusChip({ status }: { readonly status: ApplicationStatus }) {
  return <StatusChip tone={TONE[status]}>{APPLICATION_STATUS_LABELS[status]}</StatusChip>;
}
