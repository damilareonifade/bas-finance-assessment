import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../common/auth/auth.decorators';
import { CustomersService } from '../customers/customers.service';
import { AssignOfficerDto, CreateCustomerDto } from '../customers/dto/customer.dto';
import { CreateLoanProductDto, UpdateLoanProductDto } from '../loan-products/dto/loan-product.dto';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { CollectionsQueryDto, CustomerListQueryDto, ProductListQueryDto } from './dto/admin-queries.dto';
import { PortfolioService } from './portfolio.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly portfolio: PortfolioService,
  ) {}

  @Get()
  list(@Query() query: CustomerListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.portfolio.listCustomers(user, { search: query.search, officerId: query.officerId, unassignedOnly: query.unassigned === 'true' });
  }

  @Post()
  async create(@Body() body: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customers.create(body, user);
    return this.portfolio.customerDetail(user, customer.customerId);
  }

  @Get(':customerId')
  detail(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portfolio.customerDetail(user, customerId);
  }

  /** Assign (or un-assign with null) the loan officer who follows this customer up for repayment. */
  @Patch(':customerId/assignment')
  @Roles('ADMIN')
  async assign(@Param('customerId') customerId: string, @Body() body: AssignOfficerDto, @CurrentUser() user: AuthenticatedUser) {
    await this.customers.assignOfficer(customerId, body.officerId, user);
    return this.portfolio.customerDetail(user, customerId);
  }
}

@Controller('loan-products')
export class LoanProductsController {
  constructor(
    private readonly products: LoanProductsService,
    private readonly portfolio: PortfolioService,
  ) {}

  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.portfolio.listProducts(query.status);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: CreateLoanProductDto, @CurrentUser() user: AuthenticatedUser) {
    const product = await this.products.create(body, user);
    return this.portfolio.productDetail(product.productId);
  }

  @Get(':productId')
  detail(@Param('productId') productId: string) {
    return this.portfolio.productDetail(productId);
  }

  @Patch(':productId')
  @Roles('ADMIN')
  async update(@Param('productId') productId: string, @Body() body: UpdateLoanProductDto) {
    await this.products.update(productId, body);
    return this.portfolio.productDetail(productId);
  }

  /** Everyone who holds a loan or invoice facility under this product. */
  @Get(':productId/customers')
  @Roles('ADMIN')
  customersOf(@Param('productId') productId: string) {
    return this.portfolio.productCustomers(productId);
  }
}

@Controller('collections')
export class CollectionsController {
  constructor(private readonly portfolio: PortfolioService) {}

  /** The officer's follow-up list (admins can pass ?officerId=). */
  @Get('portfolio')
  portfolioFor(@Query() query: CollectionsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.portfolio.collections(user, query.officerId);
  }
}

@Controller('admin')
@Roles('ADMIN')
export class DashboardController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('dashboard')
  dashboard() {
    return this.portfolio.dashboard();
  }
}
