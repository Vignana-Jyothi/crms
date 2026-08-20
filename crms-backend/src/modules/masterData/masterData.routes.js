const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const repo = require('./masterData.repository');

const router = Router();

// All of this is reference/lookup data (Section 24 "core tables").
// Any authenticated user can read it — e.g. a Requester needs the
// list of departments and resource types to build a search filter.
router.use(authenticate);

router.get('/roles', asyncHandler(async (req, res) => res.json(await repo.listRoles())));
router.get('/departments', asyncHandler(async (req, res) => res.json(await repo.listDepartments())));
router.get('/blocks', asyncHandler(async (req, res) => res.json(await repo.listBlocks())));
router.get('/resource-types', asyncHandler(async (req, res) => res.json(await repo.listResourceTypes())));

module.exports = router;
