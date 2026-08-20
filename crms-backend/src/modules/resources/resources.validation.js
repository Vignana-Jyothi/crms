const { z } = require('zod');

const listResourcesSchema = z.object({
  query: z.object({
    resourceTypeId: z.coerce.number().int().optional(),
    departmentId: z.coerce.number().int().optional(),
    blockId: z.coerce.number().int().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    minCapacity: z.coerce.number().positive().optional(),
    capacity: z.coerce.number().positive().optional(),
  }),
});

const resourceIdParamSchema = z.object({
  params: z.object({ resourceId: z.string().min(1) }),
});

const availabilitySchema = z.object({
  params: z.object({ resourceId: z.string().min(1) }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  }),
});

const createResourceSchema = z.object({
  body: z.object({
    resourceId: z.string().min(1).max(20),
    resourceName: z.string().min(1).max(100),
    resourceTypeId: z.number().int(),
    departmentId: z.number().int().optional().nullable(),
    blockId: z.number().int().optional().nullable(),
    floor: z.string().max(10).optional().nullable(),
    capacityOrAreaSqm: z.number().positive().optional().nullable(),
    allocationNote: z.string().max(60).optional().nullable(),
    allocatedSemester: z.string().max(50).optional().nullable(),
    allocatedBranch: z.string().max(50).optional().nullable(),
    allocatedSection: z.string().max(50).optional().nullable(),
  }),
});

module.exports = {
  listResourcesSchema,
  resourceIdParamSchema,
  availabilitySchema,
  createResourceSchema,
};
