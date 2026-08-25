const { Router } = require('express');
const controller = require('./timetable.controller');
const authenticate = require('../../middleware/authenticate');

const router = Router();
router.use(authenticate);

// GET /api/v1/timetable?departmentId=&resourceId=&dayOfWeek=&academicYear=
router.get('/', controller.list);
router.post('/sync', controller.syncEduPrime);
router.get('/:timetableId', controller.getById);
router.put('/:timetableId', controller.update);

module.exports = router;
