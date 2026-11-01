const asyncHandler = require('../../utils/asyncHandler');
const service = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await service.login(email, password, req.ip);
  res.json(result);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await service.refresh(refreshToken);
  res.json(result);
});

// Any authenticated user can set their OWN password this way;
// Super Admin can reset anyone's (see auth.routes.js for the
// authorization split between the two).
const setPassword = asyncHandler(async (req, res) => {
  const { userId, newPassword } = req.body;
  await service.setPassword(userId, newPassword, req.auth.userId);
  res.status(204).send();
});

module.exports = { login, refresh, setPassword };
