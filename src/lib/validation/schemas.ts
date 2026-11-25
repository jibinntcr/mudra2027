import { z } from 'zod';

export const LoginSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, 'Login ID must be at least 3 characters')
    .max(64, 'Login ID cannot exceed 64 characters')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  returnTo: z.string().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[0-9]/, 'Password must include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current/temporary password',
    path: ['newPassword'],
  });

export const CreateAccountSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, 'Login ID must be at least 3 characters')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Login ID can only contain letters, numbers, dots, hyphens, and underscores')
    .transform((v) => v.toLowerCase()),
  displayName: z.string().trim().min(2, 'Display name is required').max(100),
  role: z.enum(['reader', 'admin']),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters').max(128),
});

export const UpdateAccountActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('toggle_active'),
    userId: z.string().min(1),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal('reset_password'),
    userId: z.string().min(1),
    temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters').max(128),
  }),
  z.object({
    action: z.literal('change_role'),
    userId: z.string().min(1),
    role: z.enum(['reader', 'admin']),
  }),
]);

export const CategoryInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  nameEn: z.string().trim().min(2).max(120),
  nameMl: z.string().trim().optional(),
  description: z.string().trim().optional(),
  parentSlug: z.string().trim().nullable().optional(),
  order: z.number().int().default(10),
  isPublished: z.boolean().default(true),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default(''),
  year: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}$/.test(v) ? parseInt(v, 10) : null)),
  hasTextLayer: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : null)),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v || '1', 10) || 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(50, Math.max(1, parseInt(v || '12', 10) || 12))),
});
