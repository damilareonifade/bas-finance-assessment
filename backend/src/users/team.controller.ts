import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../common/auth/auth.decorators';
import { InviteTeamMemberDto, SetMemberStatusDto } from './dto/team.dto';
import { InvitationsService } from './invitations.service';
import { UsersService } from './users.service';

@Controller('team')
@Roles('ADMIN')
export class TeamController {
  constructor(
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get('members')
  members() {
    return this.users.list();
  }

  @Patch('members/:userId/status')
  setStatus(@Param('userId') userId: string, @Body() body: SetMemberStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.setStatus(userId, body.status, actor.userId);
  }

  @Get('invitations')
  listInvitations() {
    return this.invitations.list();
  }

  @Post('invitations')
  invite(@Body() body: InviteTeamMemberDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.invitations.invite(body.email, body.role, actor);
  }

  @Delete('invitations/:invitationId')
  revoke(@Param('invitationId') invitationId: string) {
    return this.invitations.revoke(invitationId);
  }
}
