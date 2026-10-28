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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Filter dropdowns send "" for "All", so treat blank query params as absent.
const optionalParam = (schema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const listBookingsSchema = z.object({
  query: z
    .object({
      status: optionalParam(z.enum(['Pending', 'Approved', 'Rejected', 'Cancelled'])),
      resourceId: optionalParam(z.string().max(20)),
      departmentId: optionalParam(z.coerce.number().int().positive()),
      blockId: optionalParam(z.coerce.number().int().positive()),
      resourceTypeId: optionalParam(z.coerce.number().int().positive()),
      dateFrom: optionalParam(z.string().regex(dateRegex, 'dateFrom must be YYYY-MM-DD')),
      dateTo: optionalParam(z.string().regex(dateRegex, 'dateTo must be YYYY-MM-DD')),
      search: optionalParam(z.string().trim().max(100)),
    })
    .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
      message: 'dateFrom must be on or before dateTo',
      path: ['dateTo'],
    }),
});

const liveStatusSchema = z.object({
  query: z
    .object({
      date: optionalParam(z.string().regex(dateRegex, 'date must be YYYY-MM-DD')),
      startTime: optionalParam(z.string().regex(timeRegex, 'startTime must be HH:MM')),
      endTime: optionalParam(z.string().regex(timeRegex, 'endTime must be HH:MM')),
    })
    .refine((q) => !q.startTime || !q.endTime || q.startTime <= q.endTime, {
      message: 'endTime must not be before startTime',
      path: ['endTime'],
    }),
});

module.exports = {
  createBookingSchema,
  bookingIdParamSchema,
  cancelBookingSchema,
  listBookingsSchema,
  liveStatusSchema,
};
