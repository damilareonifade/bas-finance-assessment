export const USER_ROLES = ['ADMIN', 'LOAN_OFFICER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
}
