const { Router } = require('express');
const controller = require('./bookings.controller');
const authenticate = require('../../middleware/authenticate');
const validateRequest = require('../../middleware/validateRequest');
const { createBookingSchema, bookingIdParamSchema, cancelBookingSchema } = require('./bookings.validation');

const router = Router();
router.use(authenticate); // every booking action requires login — all four roles can at least view/create

router.post('/', validateRequest(createBookingSchema), controller.create);
router.get('/my', controller.listMy);
router.get('/', controller.list);
router.get('/:bookingId', validateRequest(bookingIdParamSchema), controller.getById);
router.post('/:bookingId/cancel', validateRequest(cancelBookingSchema), controller.cancel);

module.exports = router;
