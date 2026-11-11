import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock/clock';
import { ConflictError, NotFoundError } from '../common/errors/app-errors';
import { PrismaService } from '../database/prisma.service';
import { prepareLinesForPosting, reverseLines, JournalLine } from './domain/journal';
import { JournalEntry, LedgerRepository } from './ledger.repository';

export interface PostEntryRequest {
  readonly event: string;
  readonly postedOn: string;
  readonly lines: readonly JournalLine[];
  readonly loanId?: string;
  readonly invoiceId?: string;
  readonly customerId?: string;
}

/** The only writer of journal rows. Enforces double entry, zero-line suppression and immutability. */
@Injectable()
export class LedgerService {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Must be called inside the caller's transaction (it throws otherwise): a journal entry only makes sense committed
   * together with the loan / repayment / settlement rows it describes.
   */
  async post(request: PostEntryRequest): Promise<JournalEntry> {
    this.prisma.requireTransaction('LedgerService.post');
    const lines = prepareLinesForPosting(request.lines);
    return this.repository.insert({ ...request, lines }, this.clock.nowIso());
  }

  /** Corrects a mistake without editing history: posts the mirror image of an entry, once (reverses_entry_id is unique). */
  async reverse(entryId: string, reason: string, postedOn: string): Promise<JournalEntry> {
    return this.prisma.transaction(async () => {
      const original = await this.repository.findById(entryId);
      if (!original) throw new NotFoundError('JOURNAL_ENTRY_NOT_FOUND', `Journal entry ${entryId} does not exist`);
      if (original.reversesEntryId) throw new ConflictError('CANNOT_REVERSE_A_REVERSAL', 'A reversing entry cannot itself be reversed');
      if (await this.repository.hasReversal(entryId)) throw new ConflictError('ENTRY_ALREADY_REVERSED', `Entry ${entryId} was already reversed`);
      const lines = prepareLinesForPosting(reverseLines(original.lines));
      return this.repository.insert(
        {
          event: `Reversal of ${original.entryId}: ${reason}`,
          postedOn,
          loanId: original.loanId ?? undefined,
          invoiceId: original.invoiceId ?? undefined,
          customerId: original.customerId ?? undefined,
          reversesEntryId: entryId,
          lines,
        },
        this.clock.nowIso(),
      );
    });
  }
}
