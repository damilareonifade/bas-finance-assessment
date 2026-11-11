import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';

interface AssignOfficerPanelProps {
  readonly assignedOfficerId: string | null;
  readonly officerOptions: readonly SelectOption[];
  readonly isSaving: boolean;
  readonly errorMessage?: string;
  readonly onAssign: (officerId: string | null) => void;
}

/** Admin control: choose the loan officer who follows this customer up for repayment. */
export function AssignOfficerPanel({ assignedOfficerId, officerOptions, isSaving, errorMessage, onAssign }: AssignOfficerPanelProps) {
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>(assignedOfficerId ?? '');
  const hasChanged = selectedOfficerId !== (assignedOfficerId ?? '');

  return (
    <Card>
      <CardHeader title="Loan officer" description="The assigned officer sees this customer in their collections list and can follow up on repayments." />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Assigned officer"
          options={officerOptions}
          placeholder="Unassigned"
          value={selectedOfficerId}
          onChange={(event) => setSelectedOfficerId(event.target.value)}
        />
        <Button isLoading={isSaving} disabled={!hasChanged} onClick={() => onAssign(selectedOfficerId === '' ? null : selectedOfficerId)}>
          Save assignment
        </Button>
      </div>
      {errorMessage ? (
        <div className="mt-3">
          <Alert tone="danger">{errorMessage}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
