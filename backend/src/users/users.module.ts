import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PasswordService } from './password.service';
import { TeamController } from './team.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  controllers: [TeamController],
  providers: [UsersRepository, PasswordService, UsersService, InvitationsService],
  exports: [UsersService, InvitationsService, PasswordService, UsersRepository],
})
export class UsersModule {}
