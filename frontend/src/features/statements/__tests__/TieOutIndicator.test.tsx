import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asKobo } from '@/lib/money';
import { TieOutIndicator } from '../components/TieOutIndicator';
import { calculateTieOut } from '../statementMath';

describe('TieOutIndicator', () => {
  it('shows green success when tied out', () => {
    const [statement, schedule] = [asKobo(5_000), asKobo(5_000)];
    render(<TieOutIndicator statementClosingKobo={statement} scheduleOutstandingKobo={schedule} tieOut={calculateTieOut(statement, schedule)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tie-out: statement agrees with schedule');
  });

  it('turns red and shows the difference when they disagree', () => {
    const [statement, schedule] = [asKobo(5_050), asKobo(5_000)];
    render(<TieOutIndicator statementClosingKobo={statement} scheduleOutstandingKobo={schedule} tieOut={calculateTieOut(statement, schedule)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Tie-out failed');
    expect(screen.getByRole('alert')).toHaveTextContent('Difference: ₦0.50');
  });
});
