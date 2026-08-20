const { Router } = require('express');
const controller = require('./resources.controller');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const validateRequest = require('../../middleware/validateRequest');
const {
  listResourcesSchema,
  resourceIdParamSchema,
  availabilitySchema,
  createResourceSchema,
} = require('./resources.validation');

const router = Router();
router.use(authenticate);

// GET /api/v1/resources?resourceTypeId=&departmentId=&blockId=&status=&search=
router.get('/', validateRequest(listResourcesSchema), controller.list);

router.get('/live-status', controller.liveStatus);
router.get('/:resourceId', validateRequest(resourceIdParamSchema), controller.getById);
router.get('/:resourceId/availability', validateRequest(availabilitySchema), controller.availability);

// Only Super Admin manages the master resource list — matches
// Section 15 "Super Admin ... Add resources".
router.post(
  '/',
  authorizeRole(ROLES.SUPER_ADMIN),
  validateRequest(createResourceSchema),
  controller.create
);
router.patch('/:resourceId', authorizeRole(ROLES.SUPER_ADMIN), controller.update);

module.exports = router;
