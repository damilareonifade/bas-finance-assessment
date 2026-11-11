import { Module } from '@nestjs/common';
import { LoanProductsRepository } from './loan-products.repository';
import { LoanProductsService } from './loan-products.service';

@Module({ providers: [LoanProductsRepository, LoanProductsService], exports: [LoanProductsRepository, LoanProductsService] })
export class LoanProductsModule {}
