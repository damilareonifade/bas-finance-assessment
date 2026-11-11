import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Public } from '../common/auth/auth.decorators';
import { InvitationsService } from '../users/invitations.service';
import { StoredUser } from '../users/users.repository';
import { toAuthenticatedUser } from '../users/users.service';
import { AuthService, SESSION_COOKIE_NAME, sessionLifetimeSeconds } from './auth.service';
import { UsersService } from '../users/users.service';
import { AcceptInvitationDto, ChangePasswordDto, LoginDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly invitations: InvitationsService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response): Promise<{ user: AuthenticatedUser }> {
    const rememberMe = body.rememberMe === true;
    const { user, token } = await this.auth.login(body.email, body.password, rememberMe);
    this.setSessionCookie(response, token, rememberMe);
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Body() body: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.users.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Public()
  @Get('invitations/:token')
  describeInvitation(@Param('token') token: string) {
    return this.invitations.describe(token);
  }

  @Public()
  @Post('accept-invitation')
  async acceptInvitation(@Body() body: AcceptInvitationDto, @Res({ passthrough: true }) response: Response): Promise<{ user: AuthenticatedUser }> {
    const stored: StoredUser = await this.invitations.accept(body.token, body.fullName, body.password);
    this.setSessionCookie(response, this.auth.issueToken(stored));
    return { user: toAuthenticatedUser(stored) };
  }

  private setSessionCookie(response: Response, token: string, rememberMe = false): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionLifetimeSeconds(rememberMe) * 1000,
      path: '/',
    });
  }
}
