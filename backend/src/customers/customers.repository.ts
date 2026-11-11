import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Customer as CustomerRow, Prisma } from '../generated/prisma/client';

export interface StoredCustomer {
  readonly customerId: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly assignedOfficerId: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

const toCustomer = (row: CustomerRow): StoredCustomer => ({
  customerId: row.id,
  fullName: row.fullName,
  email: row.email,
  phone: row.phone,
  assignedOfficerId: row.assignedOfficerId,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

export interface CustomerFilter {
  readonly search?: string;
  readonly assignedOfficerId?: string;
  readonly unassignedOnly?: boolean;
}

/** Customer ID / name / email / phone contains `search` (SQLite LIKE: ASCII case-insensitive, so "cus-0001" finds CUS-000001). */
export function customerSearchCondition(search: string): Prisma.CustomerWhereInput {
  return { OR: [{ id: { contains: search } }, { fullName: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] };
}

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: { fullName: string; email?: string; phone?: string; assignedOfficerId?: string; createdBy: string; createdAt: string }): Promise<StoredCustomer> {
    const id = await this.prisma.nextId('CUS');
    const row = await this.prisma.db.customer.create({
      data: {
        id,
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        assignedOfficerId: input.assignedOfficerId ?? null,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
      },
    });
    return toCustomer(row);
  }

  async findById(customerId: string): Promise<StoredCustomer | undefined> {
    const row = await this.prisma.db.customer.findUnique({ where: { id: customerId } });
    return row ? toCustomer(row) : undefined;
  }

  async findByIds(customerIds: readonly string[]): Promise<StoredCustomer[]> {
    if (customerIds.length === 0) return [];
    return (await this.prisma.db.customer.findMany({ where: { id: { in: [...new Set(customerIds)] } } })).map(toCustomer);
  }

  async list(filter: CustomerFilter = {}): Promise<StoredCustomer[]> {
    const where: Prisma.CustomerWhereInput = {
      ...(filter.search ? customerSearchCondition(filter.search) : {}),
      ...(filter.assignedOfficerId ? { assignedOfficerId: filter.assignedOfficerId } : filter.unassignedOnly ? { assignedOfficerId: null } : {}),
    };
    return (await this.prisma.db.customer.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(toCustomer);
  }

  /** Ids only — for "officer sees their own book" scoping. */
  async idsAssignedTo(officerId: string): Promise<string[]> {
    return (await this.prisma.db.customer.findMany({ where: { assignedOfficerId: officerId }, select: { id: true } })).map((row) => row.id);
  }

  async setAssignedOfficer(customerId: string, officerId: string | null): Promise<void> {
    await this.prisma.db.customer.update({ where: { id: customerId }, data: { assignedOfficerId: officerId } });
  }
}
