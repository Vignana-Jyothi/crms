const { Router } = require('express');
const controller = require('./approvals.controller');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');

const router = Router();
router.use(authenticate);

// Requesters never see this — only the three admin tiers approve.
const canApprove = authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN);

router.get('/pending', canApprove, controller.listPending);
router.post('/:approvalId/approve', canApprove, controller.approve);
router.post('/:approvalId/reject', canApprove, controller.reject);

module.exports = router;
