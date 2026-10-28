const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM", 24-hour

const createBookingSchema = z.object({
  body: z
    .object({
      resourceId: z.string().min(1),
      bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'bookingDate must be YYYY-MM-DD'),
      startTime: z.string().regex(timeRegex, 'startTime must be HH:MM'),
      endTime: z.string().regex(timeRegex, 'endTime must be HH:MM'),
      purpose: z.string().min(3).max(500),
    })
    .refine((d) => d.startTime < d.endTime, {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    }),
});

const bookingIdParamSchema = z.object({
  params: z.object({ bookingId: z.coerce.number().int().positive() }),
});

const cancelBookingSchema = z.object({
  params: z.object({ bookingId: z.coerce.number().int().positive() }),
  body: z.object({ reason: z.string().optional() }).optional(),
});

module.exports = { createBookingSchema, bookingIdParamSchema, cancelBookingSchema };
