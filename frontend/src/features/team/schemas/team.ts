import { z } from 'zod';
import { userRoleSchema } from '@/features/auth';

export const teamMemberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: userRoleSchema,
  status: z.enum(['ACTIVE', 'DISABLED']),
  createdAt: z.string(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const invitationSchema = z.object({
  invitationId: z.string(),
  email: z.string(),
  role: userRoleSchema,
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const createdInvitationSchema = z.object({ invitation: invitationSchema, inviteLink: z.string() });
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const inviteFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email address'),
  role: userRoleSchema,
});
export type InviteFormInput = z.input<typeof inviteFormSchema>;
export type InviteRequest = z.output<typeof inviteFormSchema>;

export const INVITE_SERVER_FIELD_MAP = { email: 'email', role: 'role' } as const satisfies Record<string, keyof InviteFormInput>;
