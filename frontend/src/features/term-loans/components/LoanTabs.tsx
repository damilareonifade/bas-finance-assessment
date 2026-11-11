import { Tabs } from '@/components/layout/Tabs';

interface LoanTabsProps {
  readonly loanId: string;
  readonly activeId: 'overview' | 'statement';
}

export function LoanTabs({ loanId, activeId }: LoanTabsProps) {
  return (
    <Tabs
      label="Loan sections"
      activeId={activeId}
      tabs={[
        { id: 'overview', to: `/loans/${loanId}`, label: 'Schedule and repayments' },
        { id: 'statement', to: `/loans/${loanId}/statement`, label: 'Statement' },
      ]}
    />
  );
}
