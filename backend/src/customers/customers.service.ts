import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { fieldError, ForbiddenError, NotFoundError } from '../common/errors/app-errors';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { CustomerFilter, CustomersRepository, StoredCustomer } from './customers.repository';
import { CreateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications: NotificationsService,
  ) {}

  async create(input: CreateCustomerDto, actor: AuthenticatedUser): Promise<StoredCustomer> {
    const assignedOfficerId = actor.role === 'LOAN_OFFICER' ? actor.userId : input.assignedOfficerId;
    return this.prisma.transaction(async () => {
      if (assignedOfficerId) await this.assertActiveOfficer(assignedOfficerId, 'assignedOfficerId');
      return this.repository.insert({
        fullName: input.fullName.trim(),
        email: input.email?.toLowerCase(),
        phone: input.phone,
        assignedOfficerId,
        createdBy: actor.userId,
        createdAt: this.clock.nowIso(),
      });
    });
  }

  async getStored(customerId: string): Promise<StoredCustomer> {
    const customer = await this.repository.findById(customerId);
    if (!customer) throw new NotFoundError('CUSTOMER_NOT_FOUND', `Customer ${customerId} does not exist`);
    return customer;
  }

  findByIds(customerIds: readonly string[]): Promise<StoredCustomer[]> {
    return this.repository.findByIds(customerIds);
  }

  /** Admins see everyone; officers only the customers assigned to them. */
  listVisibleTo(actor: AuthenticatedUser, filter: CustomerFilter = {}): Promise<StoredCustomer[]> {
    return this.repository.list(actor.role === 'ADMIN' ? filter : { ...filter, assignedOfficerId: actor.userId, unassignedOnly: false });
  }

  /** The officer's own book (ids), for scoping loan / application lists. */
  idsInBookOf(officerId: string): Promise<string[]> {
    return this.repository.idsAssignedTo(officerId);
  }

  /** Unscoped list for administrative aggregation (dashboard). Never expose directly to officers. */
  listAll(): Promise<StoredCustomer[]> {
    return this.repository.list();
  }

  /**
   * The assignment and the officer's notification commit together. Joins the caller's transaction when there is one
   * (application approval assigns an officer to a customer who has none).
   */
  async assignOfficer(customerId: string, officerId: string | null, actor?: AuthenticatedUser): Promise<StoredCustomer> {
    return this.prisma.transaction(async () => {
      const customer = await this.getStored(customerId);
      if (officerId !== null) await this.assertActiveOfficer(officerId, 'officerId');
      await this.repository.setAssignedOfficer(customerId, officerId);
      if (officerId && officerId !== customer.assignedOfficerId) {
        await this.notifications.notify(
          [officerId],
          { kind: 'CUSTOMER_ASSIGNED', title: 'New customer assigned to you', body: `${customer.fullName} is now in your book.`, link: `/customers/${customerId}` },
          actor?.userId,
        );
      }
      return { ...customer, assignedOfficerId: officerId };
    });
  }

  /** Read access: admins always; officers only for their assigned customers. Records with no customer are admin-only. */
  async assertCanView(actor: AuthenticatedUser, customerId: string | null | undefined): Promise<void> {
    if (!(await this.canView(actor, customerId))) throw new ForbiddenError('This customer is not assigned to you');
  }

  async canView(actor: AuthenticatedUser, customerId: string | null | undefined): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    const customer = customerId ? await this.repository.findById(customerId) : undefined;
    return customer !== undefined && customer.assignedOfficerId === actor.userId;
  }

  /** Write access for originating loans / invoices: a real customer must be named; officers need it to be theirs. */
  async assertCanTransactFor(actor: AuthenticatedUser, customerId: string | null | undefined): Promise<void> {
    if (!customerId) {
      if (actor.role === 'ADMIN') return;
      throw fieldError('customerId', 'Choose one of your assigned customers');
    }
    if (!(await this.repository.findById(customerId))) throw fieldError('customerId', 'Customer not found');
    await this.assertCanView(actor, customerId);
  }

  /** 422 on `field` unless `userId` is an active loan officer. */
  async assertActiveOfficer(userId: string, field: string): Promise<void> {
    const user = await this.users.getStoredOrUndefined(userId);
    if (!user || user.role !== 'LOAN_OFFICER' || user.status !== 'ACTIVE') throw fieldError(field, 'Choose an active loan officer');
  }
}
