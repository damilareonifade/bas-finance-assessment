import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AreaChart, formatDayLabel, niceCeiling } from '@/components/charts/AreaChart';
import { MetricCard, trendTone } from '../MetricCard';

describe('trendTone', () => {
  it('is positive when a good metric rises and negative when it falls', () => {
    expect(trendTone({ changePercent: 12.5, comparedWith: 'x', increaseIsGood: true })).toBe('positive');
    expect(trendTone({ changePercent: -3, comparedWith: 'x', increaseIsGood: true })).toBe('negative');
  });

  it('flips for metrics where more is worse (overdue)', () => {
    expect(trendTone({ changePercent: 8, comparedWith: 'x', increaseIsGood: false })).toBe('negative');
    expect(trendTone({ changePercent: -8, comparedWith: 'x', increaseIsGood: false })).toBe('positive');
  });

  it('is neutral with nothing to compare, or no change', () => {
    expect(trendTone({ changePercent: null, comparedWith: 'x', increaseIsGood: true })).toBe('neutral');
    expect(trendTone({ changePercent: 0, comparedWith: 'x', increaseIsGood: true })).toBe('neutral');
  });
});

describe('MetricCard', () => {
  it('shows label, figure, a signed percentage with its comparison and the caption', () => {
    render(<dl><MetricCard label="Disbursed this month" value="₦35,700,000.00" trend={{ changePercent: -41.9, comparedWith: 'vs same days last month', increaseIsGood: true }} caption="₦22.3M last month" sparkline={[1, 3, 2, 5]} /></dl>);
    expect(screen.getByText('Disbursed this month')).toBeInTheDocument();
    expect(screen.getByText('₦35,700,000.00')).toBeInTheDocument();
    expect(screen.getByText(/−41\.9%/)).toBeInTheDocument();
    expect(screen.getByText(/vs same days last month/)).toBeInTheDocument();
    expect(screen.getByText('₦22.3M last month')).toBeInTheDocument();
  });

  it('says so plainly when there is nothing to compare with', () => {
    render(<dl><MetricCard label="Customers" value="8" trend={{ changePercent: null, comparedWith: 'vs x', increaseIsGood: true, emptyText: 'No new customers last month' }} /></dl>);
    expect(screen.getByText('No new customers last month')).toBeInTheDocument();
  });

  it('renders without a trend (attention cards)', () => {
    render(<dl><MetricCard label="Overdue" value="₦0.00" caption="Nothing past due" captionTone="success" /></dl>);
    expect(screen.getByText('Nothing past due')).toBeInTheDocument();
  });
});

describe('AreaChart helpers', () => {
  it.each([
    [0, 1],
    [0.7, 1],
    [1.2, 2],
    [2.3, 2.5],
    [4.1, 5],
    [9_300_000, 10_000_000],
    [112_000_000, 200_000_000],
  ])('niceCeiling(%d) = %d', (value, expected) => expect(niceCeiling(value)).toBe(expected));

  it('formats day labels', () => {
    expect(formatDayLabel('2026-11-05')).toBe('Nov 05');
    expect(formatDayLabel('2026-01-31')).toBe('Jan 31');
  });
});

describe('AreaChart', () => {
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
  const series = [
    { label: 'Disbursed', values: [100, 400, 250, 0], color: 'blue' as const },
    { label: 'Collected', values: [50, 60, 70, 80], color: 'green' as const },
  ];
  const renderChart = () => render(<AreaChart days={days} series={series} caption="Disbursed and collected for each of the last 4 days" formatAxis={(value) => `${value}u`} formatValue={(value) => `${value} units`} />);

  it('draws a legend entry per series and rounded axis ticks', () => {
    renderChart();
    expect(screen.getAllByText('Disbursed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Collected').length).toBeGreaterThan(0);
    expect(screen.getByText('500u')).toBeInTheDocument();
    expect(screen.getByText('0u')).toBeInTheDocument();
  });

  it('is described to screen readers by a caption and a full data table', () => {
    renderChart();
    expect(screen.getByRole('img', { name: /disbursed and collected/i })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /disbursed and collected/i });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + days.length);
    expect(within(rows[2] as HTMLElement).getByText('400 units')).toBeInTheDocument();
  });

  it('shows a tooltip with every series value for the hovered day', async () => {
    const user = userEvent.setup();
    renderChart();
    const chart = screen.getByRole('img', { name: /disbursed and collected/i });
    chart.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 300, right: 900, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    await user.pointer({ target: chart, coords: { clientX: 880, clientY: 100 } });
    const tooltip = await screen.findByRole('status');
    expect(within(tooltip).getByText('Jan 04')).toBeInTheDocument();
    expect(within(tooltip).getByText('0 units')).toBeInTheDocument();
    expect(within(tooltip).getByText('80 units')).toBeInTheDocument();
  });
});
