const ApiError = require('../utils/ApiError');

// Usage: router.post('/bookings', validateRequest(createBookingSchema), controller.create)
// `schema` is a Zod object shaped like { body: z.object({...}), params: z.object({...}) }
module.exports = function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      return next(ApiError.badRequest('Validation failed', result.error.flatten()));
    }
    // overwrite with parsed/coerced values (e.g. string -> number for :id params)
    req.body = result.data.body ?? req.body;
    req.params = result.data.params ?? req.params;
    req.query = result.data.query ?? req.query;
    next();
  };
};
