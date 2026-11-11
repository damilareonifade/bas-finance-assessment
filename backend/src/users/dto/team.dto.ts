import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { USER_ROLES, UserRole } from '../../common/auth/authenticated-user';

export class InviteTeamMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(USER_ROLES)
  role!: UserRole;
}

export class SetMemberStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}
