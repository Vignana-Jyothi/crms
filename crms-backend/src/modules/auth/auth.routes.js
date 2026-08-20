const { Router } = require('express');
const controller = require('./auth.controller');
const validateRequest = require('../../middleware/validateRequest');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const { loginSchema, refreshSchema, setPasswordSchema } = require('./auth.validation');
const ApiError = require('../../utils/ApiError');

const router = Router();

router.post('/login', validateRequest(loginSchema), controller.login);
router.post('/refresh', validateRequest(refreshSchema), controller.refresh);

// A user can only set THEIR OWN password unless they're Super Admin.
router.post(
  '/set-password',
  authenticate,
  validateRequest(setPasswordSchema),
  (req, res, next) => {
    const isSelf = req.body.userId === req.auth.userId;
    const isSuperAdmin = req.auth.roleId === ROLES.SUPER_ADMIN;
    if (!isSelf && !isSuperAdmin) {
      return next(ApiError.forbidden('You can only set your own password'));
    }
    next();
  },
  controller.setPassword
);

module.exports = router;
