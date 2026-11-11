import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { fromKoboColumn, toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import type { LoanProduct as ProductRow } from '../generated/prisma/client';

export type LoanProductType = 'TERM_LOAN' | 'INVOICE_FINANCING';
export type LoanProductStatus = 'ACTIVE' | 'ARCHIVED';

export interface StoredLoanProduct {
  readonly productId: string;
  readonly name: string;
  readonly type: LoanProductType;
  readonly description: string | null;
  readonly minPrincipalKobo: Kobo;
  readonly maxPrincipalKobo: Kobo;
  readonly minAnnualRatePercent: number | null;
  readonly maxAnnualRatePercent: number | null;
  readonly minTermMonths: number | null;
  readonly maxTermMonths: number | null;
  readonly status: LoanProductStatus;
  readonly createdAt: string;
}

const toProduct = (row: ProductRow): StoredLoanProduct => ({
  productId: row.id,
  name: row.name,
  type: row.type as LoanProductType,
  description: row.description,
  minPrincipalKobo: fromKoboColumn(row.minPrincipalKobo),
  maxPrincipalKobo: fromKoboColumn(row.maxPrincipalKobo),
  minAnnualRatePercent: row.minAnnualRatePercent,
  maxAnnualRatePercent: row.maxAnnualRatePercent,
  minTermMonths: row.minTermMonths,
  maxTermMonths: row.maxTermMonths,
  status: row.status as LoanProductStatus,
  createdAt: row.createdAt,
});

export type NewLoanProduct = Omit<StoredLoanProduct, 'productId' | 'createdAt'> & { createdBy: string; createdAt: string };

const limitColumns = (product: Omit<StoredLoanProduct, 'productId' | 'createdAt' | 'type'>) => ({
  name: product.name,
  description: product.description,
  minPrincipalKobo: toKoboColumn(product.minPrincipalKobo),
  maxPrincipalKobo: toKoboColumn(product.maxPrincipalKobo),
  minAnnualRatePercent: product.minAnnualRatePercent,
  maxAnnualRatePercent: product.maxAnnualRatePercent,
  minTermMonths: product.minTermMonths,
  maxTermMonths: product.maxTermMonths,
  status: product.status,
});

@Injectable()
export class LoanProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(product: NewLoanProduct): Promise<StoredLoanProduct> {
    const id = await this.prisma.nextId('PRD');
    return toProduct(await this.prisma.db.loanProduct.create({ data: { id, type: product.type, ...limitColumns(product), createdBy: product.createdBy, createdAt: product.createdAt } }));
  }

  async update(product: StoredLoanProduct): Promise<void> {
    await this.prisma.db.loanProduct.update({ where: { id: product.productId }, data: limitColumns(product) });
  }

  async findById(productId: string): Promise<StoredLoanProduct | undefined> {
    const row = await this.prisma.db.loanProduct.findUnique({ where: { id: productId } });
    return row ? toProduct(row) : undefined;
  }

  /** Case-insensitive (a trigger enforces the same rule in the database). */
  async findByName(name: string): Promise<StoredLoanProduct | undefined> {
    const [match] = await this.prisma.db.$queryRaw<Array<{ id: string }>>`SELECT id FROM loan_products WHERE lower(name) = lower(${name.trim()}) LIMIT 1`;
    return match ? this.findById(match.id) : undefined;
  }

  async list(status?: LoanProductStatus): Promise<StoredLoanProduct[]> {
    const rows = await this.prisma.db.loanProduct.findMany({ where: status ? { status } : {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toProduct);
  }
}
