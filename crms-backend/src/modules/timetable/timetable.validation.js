const { z } = require('zod');

const timetableIdParamSchema = z.object({
  params: z.object({ timetableId: z.coerce.number().int().positive() }),
});

const updateTimetableSchema = z.object({
  params: z.object({ timetableId: z.coerce.number().int().positive() }),
  body: z
    .object({
      facultyName: z.string().trim().min(1).max(100).optional(),
      courseCode: z.string().trim().min(1).max(20).optional(),
      courseName: z.string().trim().min(1).max(100).optional(),
      resourceId: z.string().trim().min(1).max(20).optional(),
      section: z.string().trim().min(1).max(20).optional(),
    })
    .strict(),
});
const createTimetableSchema = z.object({
  body: z
    .object({
      dayOfWeek: z.string().min(1).max(10),
      startTime: z.string(),
      endTime: z.string(),
      departmentId: z.coerce.number().int().positive().optional().nullable(),
      studentYear: z.string().max(20).optional(),
      academicYear: z.string().max(20).optional(),
      facultyName: z.string().trim().max(500).optional().nullable(),
      courseCode: z.string().trim().max(255).optional().nullable(),
      courseName: z.string().trim().max(500).optional().nullable(),
      resourceId: z.string().trim().max(20).optional().nullable(),
      section: z.string().trim().max(20).optional().nullable(),
    })
    .strict(),
});

module.exports = { timetableIdParamSchema, updateTimetableSchema, createTimetableSchema };
