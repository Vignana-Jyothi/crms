const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const repo = require('./masterData.repository');

const cacheMiddleware = require('../../middleware/cacheMiddleware');
const router = Router();

// All of this is reference/lookup data (Section 24 "core tables").
// Any authenticated user can read it — e.g. a Requester needs the
// list of departments and resource types to build a search filter.
//
// The middleware is attached per route, not with router.use(): this
// router is mounted at /api/v1, so router.use() would also run for
// every later /api/v1 route (bookings, live status, approvals...) and
// serve their responses from a URL-keyed 24h cache shared by all users.
const lookup = [authenticate, cacheMiddleware(86400)]; // Cache master data for 24 hours

router.get('/roles', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listRoles())));
router.get('/departments', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listDepartments())));
router.get('/blocks', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listBlocks())));
router.get('/resource-types', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listResourceTypes())));
router.get('/faculty', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listFaculty())));
router.get('/sections', ...lookup, asyncHandler(async (req, res) => res.json(await repo.listSections())));

module.exports = router;
