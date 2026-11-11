import { Injectable } from '@nestjs/common';
import { addDays, asCalendarDate } from '../common/dates/calendar-date';
import { fromKoboSum } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';

export type DailyTotals = ReadonlyMap<string, number>;

/** Per-day totals for the dashboard's sparklines and chart. Every query is bounded by a [from, to] calendar-date window. */
@Injectable()
export class DashboardTrendsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async disbursedByDay(from: string, to: string): Promise<DailyTotals> {
    const groups = await this.prisma.db.termLoan.groupBy({ by: ['disbursedOn'], where: { disbursedOn: { gte: from, lte: to } }, _sum: { principalKobo: true } });
    return new Map(groups.map((group) => [group.disbursedOn, fromKoboSum(group._sum.principalKobo)]));
  }

  async collectedByDay(from: string, to: string): Promise<DailyTotals> {
    const groups = await this.prisma.db.repayment.groupBy({ by: ['paymentDate'], where: { paymentDate: { gte: from, lte: to } }, _sum: { amountKobo: true } });
    return new Map(groups.map((group) => [group.paymentDate, fromKoboSum(group._sum.amountKobo)]));
  }

  async invoiceAdvancesByDay(from: string, to: string): Promise<DailyTotals> {
    const groups = await this.prisma.db.invoice.groupBy({ by: ['issueDate'], where: { issueDate: { gte: from, lte: to } }, _sum: { advanceKobo: true } });
    return new Map(groups.map((group) => [group.issueDate, fromKoboSum(group._sum.advanceKobo)]));
  }

  /** created_at is an ISO timestamp; the calendar day is its first 10 characters. */
  async newCustomersByDay(from: string, to: string): Promise<DailyTotals> {
    const rows = await this.prisma.db.customer.findMany({ where: { createdAt: { gte: from, lt: addDays(asCalendarDate(to), 1) } }, select: { createdAt: true } });
    const totals = new Map<string, number>();
    for (const { createdAt } of rows) totals.set(createdAt.slice(0, 10), (totals.get(createdAt.slice(0, 10)) ?? 0) + 1);
    return totals;
  }
}
