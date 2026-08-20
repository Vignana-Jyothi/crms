const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

// Used by an admin to set/reset a colleague's password the first
// time — your 62 real users were seeded without one (see
// prisma/migrations/000_add_auth_columns.sql).
const setPasswordSchema = z.object({
  body: z.object({
    userId: z.coerce.number().int().positive(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

module.exports = { loginSchema, refreshSchema, setPasswordSchema };
