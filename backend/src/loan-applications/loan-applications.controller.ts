import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../common/auth/auth.decorators';
import { Idempotency } from '../common/idempotency/idempotency-key.decorator';
import type { IdempotencyContext } from '../common/idempotency/idempotency.service';
import { ApplicationListQueryDto, ApproveApplicationDto, AssignApplicationOfficerDto, CreateLoanApplicationDto, RejectApplicationDto } from './dto/loan-application.dto';
import { LoanApplicationsService } from './loan-applications.service';

@Controller('loan-applications')
export class LoanApplicationsController {
  constructor(private readonly applications: LoanApplicationsService) {}

  /** ?status=OPEN|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED&officerId=me|<id>&decidedBy=me|<id>&customerId=&search= */
  @Get()
  list(@Query() query: ApplicationListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const resolve = (value: string | undefined) => (value === 'me' ? user.userId : value);
    return this.applications.list(user, {
      statuses: query.status === 'OPEN' ? ['SUBMITTED', 'UNDER_REVIEW'] : query.status ? [query.status] : undefined,
      assignedOfficerId: resolve(query.officerId),
      decidedBy: resolve(query.decidedBy),
      customerId: query.customerId,
      search: query.search?.trim() || undefined,
    });
  }

  @Post()
  submit(@Body() body: CreateLoanApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.submit(body, user);
  }

  @Get(':applicationId')
  get(@Param('applicationId') applicationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.get(user, applicationId);
  }

  @Post(':applicationId/review')
  @HttpCode(200)
  startReview(@Param('applicationId') applicationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.startReview(user, applicationId);
  }

  @Patch(':applicationId/assignment')
  @Roles('ADMIN')
  assign(@Param('applicationId') applicationId: string, @Body() body: AssignApplicationOfficerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.assignOfficer(user, applicationId, body.officerId);
  }

  @Post(':applicationId/approve')
  approve(@Param('applicationId') applicationId: string, @Body() body: ApproveApplicationDto, @Idempotency() idempotency: IdempotencyContext, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.approve(user, applicationId, body, idempotency);
  }

  @Post(':applicationId/reject')
  @HttpCode(200)
  reject(@Param('applicationId') applicationId: string, @Body() body: RejectApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.reject(user, applicationId, body.reason);
  }
}
