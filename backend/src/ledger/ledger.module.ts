import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({ providers: [LedgerRepository, LedgerService], exports: [LedgerRepository, LedgerService] })
export class LedgerModule {}
