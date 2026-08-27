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

const updateResourceSchema = z.object({
  params: z.object({ resourceId: z.string().min(1).max(20) }),
  body: z
    .object({
      resourceName: z.string().trim().min(1).max(100).optional(),
      resourceTypeId: z.number().int().positive().optional(),
      departmentId: z.number().int().positive().nullable().optional(),
      blockId: z.number().int().positive().nullable().optional(),
      floor: z.string().trim().max(10).nullable().optional(),
      capacityOrAreaSqm: z.number().positive().nullable().optional(),
      allocationNote: z.string().trim().max(60).nullable().optional(),
      allocatedSemester: z.string().trim().max(50).nullable().optional(),
      allocatedBranch: z.string().trim().max(50).nullable().optional(),
      allocatedSection: z.string().trim().max(50).nullable().optional(),
      status: z.enum(['Active', 'Inactive', 'Maintenance']).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, 'At least one field is required'),
});

module.exports = {
  listResourcesSchema,
  resourceIdParamSchema,
  availabilitySchema,
  createResourceSchema,
  updateResourceSchema,
};
