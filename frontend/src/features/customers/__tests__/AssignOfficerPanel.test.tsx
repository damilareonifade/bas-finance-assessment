import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssignOfficerPanel } from '../components/AssignOfficerPanel';

const officers = [
  { value: 'USR-2', label: 'Ada Officer' },
  { value: 'USR-3', label: 'Bola Officer' },
];

describe('AssignOfficerPanel', () => {
  it('only enables saving once the choice changes, then assigns the chosen officer', async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();
    render(<AssignOfficerPanel assignedOfficerId={null} officerOptions={officers} isSaving={false} onAssign={onAssign} />);
    const save = screen.getByRole('button', { name: /save assignment/i });
    expect(save).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Assigned officer'), 'USR-3');
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onAssign).toHaveBeenCalledWith('USR-3');
  });

  it('un-assigns with null', async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();
    render(<AssignOfficerPanel assignedOfficerId="USR-2" officerOptions={officers} isSaving={false} onAssign={onAssign} />);
    await user.selectOptions(screen.getByLabelText('Assigned officer'), '');
    await user.click(screen.getByRole('button', { name: /save assignment/i }));
    expect(onAssign).toHaveBeenCalledWith(null);
  });

  it('shows a server error', () => {
    render(<AssignOfficerPanel assignedOfficerId={null} officerOptions={officers} isSaving={false} errorMessage="Choose an active loan officer" onAssign={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an active loan officer');
  });
});
