import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { TermLoansModule } from '../term-loans/term-loans.module';
import { StatementsController } from './statements.controller';

@Module({ imports: [LedgerModule, TermLoansModule], controllers: [StatementsController] })
export class StatementsModule {}
