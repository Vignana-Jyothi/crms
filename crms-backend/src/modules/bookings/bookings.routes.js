const { Router } = require('express');
const controller = require('./bookings.controller');
const authenticate = require('../../middleware/authenticate');
const validateRequest = require('../../middleware/validateRequest');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../middleware/authorizeRole');
const {
  createBookingSchema,
  bookingIdParamSchema,
  cancelBookingSchema,
  listBookingsSchema,
} = require('./bookings.validation');

const router = Router();
router.use(authenticate); // every booking action requires login

// Viewers can see which rooms are free or booked, but not book or cancel.
// Checked per request because loadRoles may remap ROLES after startup.
function denyViewers(req, res, next) {
  if (req.auth.roleId === ROLES.VIEWER) {
    return next(ApiError.forbidden('Your account can see rooms but cannot book them'));
  }
  next();
}

router.post('/', denyViewers, validateRequest(createBookingSchema), controller.create);
router.get('/my', controller.listMy);
router.get('/', validateRequest(listBookingsSchema), controller.list);
router.get('/:bookingId', validateRequest(bookingIdParamSchema), controller.getById);
router.post('/:bookingId/cancel', denyViewers, validateRequest(cancelBookingSchema), controller.cancel);

module.exports = router;
