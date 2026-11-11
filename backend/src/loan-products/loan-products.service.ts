import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { ConflictError, fieldError, FieldError, NotFoundError, ValidationFailedError } from '../common/errors/app-errors';
import { asKobo, formatKoboForMessage, MAX_ANNUAL_RATE_PERCENT, MAX_PRINCIPAL_KOBO, MAX_TERM_MONTHS, MIN_ANNUAL_RATE_PERCENT, MIN_PRINCIPAL_KOBO, MIN_TERM_MONTHS } from '../common/money';
import { PrismaService } from '../database/prisma.service';
import { CreateLoanProductDto, UpdateLoanProductDto } from './dto/loan-product.dto';
import { LoanProductsRepository, LoanProductType, StoredLoanProduct } from './loan-products.repository';

export interface ProposedFacility {
  readonly principalKobo: number;
  readonly annualRatePercent?: number;
  readonly termMonths?: number;
}

@Injectable()
export class LoanProductsService {
  constructor(
    private readonly repository: LoanProductsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async create(input: CreateLoanProductDto, actor: AuthenticatedUser): Promise<StoredLoanProduct> {
    const isTermLoan = input.type === 'TERM_LOAN';
    const draft: StoredLoanProduct = {
      productId: '',
      name: input.name.trim(),
      type: input.type,
      description: input.description ?? null,
      minPrincipalKobo: asKobo(input.minPrincipalKobo ?? MIN_PRINCIPAL_KOBO),
      maxPrincipalKobo: asKobo(input.maxPrincipalKobo ?? MAX_PRINCIPAL_KOBO),
      minAnnualRatePercent: isTermLoan ? (input.minAnnualRatePercent ?? MIN_ANNUAL_RATE_PERCENT) : null,
      maxAnnualRatePercent: isTermLoan ? (input.maxAnnualRatePercent ?? MAX_ANNUAL_RATE_PERCENT) : null,
      minTermMonths: isTermLoan ? (input.minTermMonths ?? MIN_TERM_MONTHS) : null,
      maxTermMonths: isTermLoan ? (input.maxTermMonths ?? MAX_TERM_MONTHS) : null,
      status: 'ACTIVE',
      createdAt: this.clock.nowIso(),
    };
    this.assertConsistent(draft);
    return this.prisma.transaction(async () => {
      if (await this.repository.findByName(draft.name)) throw new ConflictError('PRODUCT_NAME_TAKEN', 'A loan product with this name already exists');
      return this.repository.insert({ ...draft, createdBy: actor.userId });
    });
  }

  /** Read, check and write in one transaction so two admins editing at once cannot interleave. */
  async update(productId: string, changes: UpdateLoanProductDto): Promise<StoredLoanProduct> {
    return this.prisma.transaction(async () => {
      const current = await this.getStored(productId);
      if (changes.name && changes.name.trim().toLowerCase() !== current.name.toLowerCase() && (await this.repository.findByName(changes.name))) {
        throw new ConflictError('PRODUCT_NAME_TAKEN', 'A loan product with this name already exists');
      }
      const isTermLoan = current.type === 'TERM_LOAN';
      const next: StoredLoanProduct = {
        ...current,
        name: changes.name?.trim() ?? current.name,
        description: changes.description ?? current.description,
        status: changes.status ?? current.status,
        minPrincipalKobo: changes.minPrincipalKobo === undefined ? current.minPrincipalKobo : asKobo(changes.minPrincipalKobo),
        maxPrincipalKobo: changes.maxPrincipalKobo === undefined ? current.maxPrincipalKobo : asKobo(changes.maxPrincipalKobo),
        minAnnualRatePercent: isTermLoan ? (changes.minAnnualRatePercent ?? current.minAnnualRatePercent) : null,
        maxAnnualRatePercent: isTermLoan ? (changes.maxAnnualRatePercent ?? current.maxAnnualRatePercent) : null,
        minTermMonths: isTermLoan ? (changes.minTermMonths ?? current.minTermMonths) : null,
        maxTermMonths: isTermLoan ? (changes.maxTermMonths ?? current.maxTermMonths) : null,
      };
      this.assertConsistent(next);
      await this.repository.update(next);
      return next;
    });
  }

  async getStored(productId: string): Promise<StoredLoanProduct> {
    const product = await this.repository.findById(productId);
    if (!product) throw new NotFoundError('LOAN_PRODUCT_NOT_FOUND', `Loan product ${productId} does not exist`);
    return product;
  }

  list(status?: 'ACTIVE' | 'ARCHIVED'): Promise<StoredLoanProduct[]> {
    return this.repository.list(status);
  }

  /**
   * A facility may only be written under an ACTIVE product of the right type, inside the product's limits.
   * Call it inside the posting's transaction so a product archived a moment earlier is seen.
   */
  async assertFacilityFits(productId: string, type: LoanProductType, facility: ProposedFacility): Promise<void> {
    const product = await this.repository.findById(productId);
    if (!product) throw fieldError('loanProductId', 'Loan product not found');
    if (product.status !== 'ACTIVE') throw fieldError('loanProductId', 'This loan product is archived');
    if (product.type !== type) throw fieldError('loanProductId', `This product is for ${product.type === 'TERM_LOAN' ? 'term loans' : 'invoice financing'}`);

    // Messages are shown to staff as-is against the field, so they are whole sentences in naira, naming the product.
    const problems: FieldError[] = [];
    if (facility.principalKobo < product.minPrincipalKobo || facility.principalKobo > product.maxPrincipalKobo) {
      const range = `${formatKoboForMessage(product.minPrincipalKobo)} to ${formatKoboForMessage(product.maxPrincipalKobo)}`;
      problems.push(
        type === 'TERM_LOAN'
          ? { field: 'principalKobo', message: `${product.name} lends ${range}. ${formatKoboForMessage(asKobo(facility.principalKobo))} is ${facility.principalKobo > product.maxPrincipalKobo ? 'above' : 'below'} that.` }
          : { field: 'faceValueKobo', message: `${product.name} finances invoices of ${range}. ${formatKoboForMessage(asKobo(facility.principalKobo))} is ${facility.principalKobo > product.maxPrincipalKobo ? 'above' : 'below'} that.` },
      );
    }
    if (type === 'TERM_LOAN') {
      if (facility.annualRatePercent !== undefined && product.minAnnualRatePercent !== null && product.maxAnnualRatePercent !== null &&
          (facility.annualRatePercent < product.minAnnualRatePercent || facility.annualRatePercent > product.maxAnnualRatePercent)) {
        problems.push({ field: 'annualRatePercent', message: `${product.name} charges ${product.minAnnualRatePercent}% to ${product.maxAnnualRatePercent}% a year. ${facility.annualRatePercent}% is outside that.` });
      }
      if (facility.termMonths !== undefined && product.minTermMonths !== null && product.maxTermMonths !== null &&
          (facility.termMonths < product.minTermMonths || facility.termMonths > product.maxTermMonths)) {
        problems.push({ field: 'termMonths', message: `${product.name} runs for ${product.minTermMonths} to ${product.maxTermMonths} months. ${facility.termMonths} months is outside that.` });
      }
    }
    if (problems.length > 0) throw new ValidationFailedError(problems);
  }

  private assertConsistent(product: StoredLoanProduct): void {
    const problems: FieldError[] = [];
    if (product.minPrincipalKobo > product.maxPrincipalKobo) problems.push({ field: 'minPrincipalKobo', message: 'must not exceed maxPrincipalKobo' });
    if (product.type === 'TERM_LOAN') {
      if (product.maxPrincipalKobo > MAX_PRINCIPAL_KOBO) problems.push({ field: 'maxPrincipalKobo', message: `term loans are capped at ${MAX_PRINCIPAL_KOBO} kobo` });
      if ((product.minAnnualRatePercent ?? 0) > (product.maxAnnualRatePercent ?? 0)) problems.push({ field: 'minAnnualRatePercent', message: 'must not exceed maxAnnualRatePercent' });
      if ((product.minTermMonths ?? 0) > (product.maxTermMonths ?? 0)) problems.push({ field: 'minTermMonths', message: 'must not exceed maxTermMonths' });
    }
    if (problems.length > 0) throw new ValidationFailedError(problems);
  }
}
