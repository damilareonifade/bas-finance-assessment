import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { customerSearchCondition } from '../customers/customers.repository';
import { fromKoboColumn, toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import type { LoanApplication as ApplicationRow, Prisma } from '../generated/prisma/client';

export const APPLICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
/** STAFF: entered by a team member (submittedBy). PORTAL: the applicant applied online (submittedBy is null). */
export type ApplicationChannel = 'STAFF' | 'PORTAL';

export interface StoredApplication {
  readonly applicationId: string;
  readonly customerId: string;
  readonly loanProductId: string | null;
  readonly principalKobo: Kobo;
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly purpose: string | null;
  readonly status: ApplicationStatus;
  readonly assignedOfficerId: string | null;
  readonly channel: ApplicationChannel;
  readonly submittedBy: string | null;
  readonly submittedAt: string;
  readonly reviewedBy: string | null;
  readonly reviewStartedAt: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly rejectionReason: string | null;
  readonly loanId: string | null;
}

const toApplication = (row: ApplicationRow): StoredApplication => ({
  applicationId: row.id,
  customerId: row.customerId,
  loanProductId: row.loanProductId,
  principalKobo: fromKoboColumn(row.principalKobo),
  annualRatePercent: row.annualRatePercent,
  termMonths: row.termMonths,
  purpose: row.purpose,
  status: row.status as ApplicationStatus,
  assignedOfficerId: row.assignedOfficerId,
  channel: row.channel as ApplicationChannel,
  submittedBy: row.submittedBy,
  submittedAt: row.submittedAt,
  reviewedBy: row.reviewedBy,
  reviewStartedAt: row.reviewStartedAt,
  decidedBy: row.decidedBy,
  decidedAt: row.decidedAt,
  rejectionReason: row.rejectionReason,
  loanId: row.loanId,
});

/** Statuses an application can still move out of. */
export const OPEN_APPLICATION_STATUSES: readonly ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

export interface ApplicationFilter {
  readonly statuses?: readonly ApplicationStatus[];
  readonly assignedOfficerId?: string;
  readonly decidedBy?: string;
  readonly customerId?: string;
  /** Matches the application id or the applicant's name / email / phone. */
  readonly search?: string;
  /** Officer scope: applications of these customers OR assigned to this officer. */
  readonly visibleTo?: { readonly customerIds: readonly string[]; readonly officerId: string };
}

@Injectable()
export class LoanApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: Omit<StoredApplication, 'applicationId' | 'status' | 'reviewedBy' | 'reviewStartedAt' | 'decidedBy' | 'decidedAt' | 'rejectionReason' | 'loanId'>): Promise<string> {
    const id = await this.prisma.nextId('APP');
    await this.prisma.db.loanApplication.create({
      data: {
        id,
        customerId: input.customerId,
        loanProductId: input.loanProductId,
        principalKobo: toKoboColumn(input.principalKobo),
        annualRatePercent: input.annualRatePercent,
        termMonths: input.termMonths,
        purpose: input.purpose,
        status: 'SUBMITTED',
        assignedOfficerId: input.assignedOfficerId,
        channel: input.channel,
        submittedBy: input.submittedBy,
        submittedAt: input.submittedAt,
      },
    });
    return id;
  }

  async findById(applicationId: string): Promise<StoredApplication | undefined> {
    const row = await this.prisma.db.loanApplication.findUnique({ where: { id: applicationId } });
    return row ? toApplication(row) : undefined;
  }

  async list(filter: ApplicationFilter = {}): Promise<StoredApplication[]> {
    const where: Prisma.LoanApplicationWhereInput = {
      ...(filter.statuses && filter.statuses.length > 0 ? { status: { in: [...filter.statuses] } } : {}),
      ...(filter.assignedOfficerId ? { assignedOfficerId: filter.assignedOfficerId } : {}),
      ...(filter.decidedBy ? { decidedBy: filter.decidedBy } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      AND: [
        ...(filter.search ? [{ OR: [{ id: { contains: filter.search } }, { customer: customerSearchCondition(filter.search) }] }] : []),
        ...(filter.visibleTo
          ? [{ OR: [{ customerId: { in: [...filter.visibleTo.customerIds] } }, { assignedOfficerId: filter.visibleTo.officerId }] }]
          : []),
      ],
    };
    const rows = await this.prisma.db.loanApplication.findMany({ where, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toApplication);
  }

  /*
   * Every state change below is a compare-and-set: it only applies while the application is still in the status it was
   * read in, and returns false when another request changed it first. That is the lock — no read-then-write gap.
   */

  async startReview(applicationId: string, reviewerId: string, at: string): Promise<boolean> {
    const { count } = await this.prisma.db.loanApplication.updateMany({
      where: { id: applicationId, status: 'SUBMITTED' },
      data: { status: 'UNDER_REVIEW', reviewedBy: reviewerId, reviewStartedAt: at },
    });
    return count === 1;
  }

  async setOfficerWhileOpen(applicationId: string, officerId: string | null): Promise<boolean> {
    const { count } = await this.prisma.db.loanApplication.updateMany({
      where: { id: applicationId, status: { in: [...OPEN_APPLICATION_STATUSES] } },
      data: { assignedOfficerId: officerId },
    });
    return count === 1;
  }

  /** Claims the application for approval (open → APPROVED). The loan id is attached once the loan exists, same transaction. */
  async claimForApproval(applicationId: string, input: { decidedBy: string; decidedAt: string; officerId: string | null }): Promise<boolean> {
    const { count } = await this.prisma.db.loanApplication.updateMany({
      where: { id: applicationId, status: { in: [...OPEN_APPLICATION_STATUSES] } },
      data: { status: 'APPROVED', decidedBy: input.decidedBy, decidedAt: input.decidedAt, assignedOfficerId: input.officerId },
    });
    return count === 1;
  }

  async attachLoan(applicationId: string, loanId: string): Promise<void> {
    await this.prisma.db.loanApplication.update({ where: { id: applicationId }, data: { loanId } });
  }

  async reject(applicationId: string, input: { decidedBy: string; decidedAt: string; reason: string }): Promise<boolean> {
    const { count } = await this.prisma.db.loanApplication.updateMany({
      where: { id: applicationId, status: { in: [...OPEN_APPLICATION_STATUSES] } },
      data: { status: 'REJECTED', decidedBy: input.decidedBy, decidedAt: input.decidedAt, rejectionReason: input.reason },
    });
    return count === 1;
  }
}
