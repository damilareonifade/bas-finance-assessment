import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/auth/auth.decorators';
import { fieldError } from '../common/errors/app-errors';
import { LedgerQueryDto, LedgerSearchQueryDto } from './dto/admin-queries.dto';
import { LedgerBookService } from './ledger-book.service';

/** The admin ledger: search a customer, see every debit and credit attributed to them (by product, account, period). */
@Controller('ledger')
@Roles('ADMIN')
export class LedgerBookController {
  constructor(private readonly ledgerBook: LedgerBookService) {}

  /** ?customerId=&loanProductId=&from=&to= — all optional; nothing chosen means the whole book. */
  @Get()
  view(@Query() query: LedgerQueryDto) {
    if (query.from && query.to && query.from > query.to) throw fieldError('to', 'The end date must be on or after the start date');
    return this.ledgerBook.view(query);
  }

  /** ?q= customer name / id / email / phone, or a loan, invoice or journal entry id. */
  @Get('search')
  search(@Query() query: LedgerSearchQueryDto) {
    return this.ledgerBook.search(query.q);
  }
}
