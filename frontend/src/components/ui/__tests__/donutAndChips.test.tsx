import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DonutChart, sharePercent } from '@/components/charts/DonutChart';
import { MetricCard } from '../MetricCard';

describe('sharePercent', () => {
  it.each([
    [1, 3, 33.3],
    [2, 3, 66.7],
    [5, 5, 100],
    [0, 0, 0],
  ])('%d of %d = %d%%', (value, total, expected) => expect(sharePercent(value, total)).toBe(expected));
});

describe('DonutChart', () => {
  it('shows the centre total and a legend row with amount and share per segment', () => {
    render(
      <DonutChart
        caption="Outstanding by product"
        centerValue="₦48.2M"
        centerLabel="Outstanding"
        formatValue={(value) => `${value}u`}
        segments={[
          { label: 'SME Term Loan', value: 30, color: 'brand' },
          { label: 'Invoice Advance', value: 10, color: 'cyan' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Outstanding by product' })).toBeInTheDocument();
    expect(screen.getByText('₦48.2M')).toBeInTheDocument();
    expect(screen.getByText('SME Term Loan')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});

describe('MetricCard format', () => {
  it('shows the change as a pill, with the full comparison as tooltip and screen-reader text', () => {
    render(<dl><MetricCard label="Disbursed this month" value="₦35.7M" trend={{ changePercent: 12.5, comparedWith: 'vs same days last month', increaseIsGood: true }} /></dl>);
    const pill = screen.getByTitle('+12.5% vs same days last month');
    expect(pill).toHaveTextContent('12.5%');
    expect(pill).toHaveClass('text-success');
  });

  it('colours a rise red when more is worse', () => {
    render(<dl><MetricCard label="Overdue" value="₦1.4M" trend={{ changePercent: 8, comparedWith: 'vs last month', increaseIsGood: false }} /></dl>);
    expect(screen.getByTitle('+8% vs last month')).toHaveClass('text-danger');
  });
});
