import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import { PaymentAllocation } from './domain/allocate-payment';

@Injectable()
export class RepaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: {
    loanId: string;
    amountKobo: Kobo;
    paymentDate: string;
    allocation: PaymentAllocation;
    journalEntryId: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<string> {
    const id = await this.prisma.nextId('RP');
    await this.prisma.db.repayment.create({
      data: {
        id,
        loanId: input.loanId,
        amountKobo: toKoboColumn(input.amountKobo),
        paymentDate: input.paymentDate,
        allocationJson: JSON.stringify(input.allocation),
        unappliedKobo: toKoboColumn(input.allocation.unappliedCreditKobo),
        journalEntryId: input.journalEntryId,
        createdBy: input.createdBy ?? null,
        createdAt: input.createdAt,
      },
    });
    return id;
  }
}
