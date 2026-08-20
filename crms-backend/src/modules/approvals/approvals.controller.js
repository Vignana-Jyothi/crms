const asyncHandler = require('../../utils/asyncHandler');
const service = require('./approvals.service');

const listPending = asyncHandler(async (req, res) => {
  res.json(await service.listPending(req.auth));
});

const approve = asyncHandler(async (req, res) => {
  const result = await service.decide(Number(req.params.approvalId), 'Approved', req.body.remarks, req.auth);
  res.json(result);
});

const reject = asyncHandler(async (req, res) => {
  const result = await service.decide(Number(req.params.approvalId), 'Rejected', req.body.remarks, req.auth);
  res.json(result);
});

module.exports = { listPending, approve, reject };
