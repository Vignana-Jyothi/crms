const { Router } = require('express');
const controller = require('./timetable.controller');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const validateRequest = require('../../middleware/validateRequest');
const { timetableIdParamSchema, updateTimetableSchema, createTimetableSchema } = require('./timetable.validation');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(authenticate);

// POST /api/v1/timetable/extract
router.post(
  '/extract',
  authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN),
  upload.single('file'),
  controller.extractFromFile
);

// POST /api/v1/timetable/batch
router.post(
  '/batch',
  authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN),
  controller.batchCreate
);

// GET /api/v1/timetable?departmentId=&resourceId=&dayOfWeek=&academicYear=
router.get('/', controller.list);
router.post('/sync', authorizeRole(ROLES.SUPER_ADMIN), controller.syncEduPrime);
router.get('/:timetableId', validateRequest(timetableIdParamSchema), controller.getById);
router.post(
  '/',
  authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN),
  validateRequest(createTimetableSchema),
  controller.create
);
router.put(
  '/:timetableId',
  authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN),
  validateRequest(updateTimetableSchema),
  controller.update
);

module.exports = router;
