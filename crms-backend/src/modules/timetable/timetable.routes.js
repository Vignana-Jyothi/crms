const { Router } = require('express');
const controller = require('./timetable.controller');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const validateRequest = require('../../middleware/validateRequest');
const { timetableIdParamSchema, updateTimetableSchema } = require('./timetable.validation');

const router = Router();

router.use(authenticate);

// GET /api/v1/timetable?departmentId=&resourceId=&dayOfWeek=&academicYear=
router.get('/', controller.list);
router.post('/sync', authorizeRole(ROLES.SUPER_ADMIN), controller.syncEduPrime);
router.get('/:timetableId', validateRequest(timetableIdParamSchema), controller.getById);
router.put(
  '/:timetableId',
  authorizeRole(ROLES.SUPER_ADMIN),
  validateRequest(updateTimetableSchema),
  controller.update
);

module.exports = router;
