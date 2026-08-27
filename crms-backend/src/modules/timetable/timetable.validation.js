const { z } = require('zod');

const timetableIdParamSchema = z.object({
  params: z.object({ timetableId: z.coerce.number().int().positive() }),
});

const updateTimetableSchema = z.object({
  params: z.object({ timetableId: z.coerce.number().int().positive() }),
  body: z
    .object({
      facultyName: z.string().trim().min(1).max(100).nullable(),
    })
    .strict(),
});

module.exports = { timetableIdParamSchema, updateTimetableSchema };
