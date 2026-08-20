const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const auditService = require('./audit.service');

const router = Router();

// Audit logs answer "who changed what and when" (Section 42) —
// Super Admin only, since this is the most sensitive read in the
// whole API (it can reveal who approved/rejected what, role
// changes, login activity, etc.)
router.get(
  '/',
  authenticate,
  authorizeRole(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    res.json(await auditService.list(req.query));
  })
);

module.exports = router;
