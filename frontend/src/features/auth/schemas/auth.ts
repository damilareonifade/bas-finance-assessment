import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'LOAN_OFFICER']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: 'Administrator',
  LOAN_OFFICER: 'Loan officer',
};

export const sessionUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: userRoleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({ user: sessionUserSchema });

export const invitationPreviewSchema = z.object({ email: z.string(), role: userRoleSchema });

/* ---------- Forms ---------- */

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});
export type LoginFormInput = z.input<typeof loginFormSchema>;
export type LoginRequest = z.output<typeof loginFormSchema>;

export const acceptInvitationFormSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Repeat your password'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type AcceptInvitationFormInput = z.input<typeof acceptInvitationFormSchema>;
export type AcceptInvitationValues = z.output<typeof acceptInvitationFormSchema>;

export const LOGIN_SERVER_FIELD_MAP = { email: 'email', password: 'password' } as const satisfies Record<string, keyof LoginFormInput>;
export const ACCEPT_INVITATION_SERVER_FIELD_MAP = {
  fullName: 'fullName',
  password: 'password',
} as const satisfies Record<string, keyof AcceptInvitationFormInput>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Repeat your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ChangePasswordFormInput = z.input<typeof changePasswordFormSchema>;
export type ChangePasswordValues = z.output<typeof changePasswordFormSchema>;

export const CHANGE_PASSWORD_SERVER_FIELD_MAP = {
  currentPassword: 'currentPassword',
  newPassword: 'newPassword',
} as const satisfies Record<string, keyof ChangePasswordFormInput>;
