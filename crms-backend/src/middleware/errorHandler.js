const ApiError = require('../utils/ApiError');

// Centralized error handler — every controller just throws ApiError
// (or lets a Prisma error bubble up) and this turns it into a
// consistent JSON response. Must be registered LAST in app.js.
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  // Always log the exact error and request details to the server console
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR in ${req.method} ${req.originalUrl}`);
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
    });
  }

  // Prisma unique-constraint violation (e.g. duplicate email/phone)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: `A record with this ${err.meta?.target?.join(', ') || 'value'} already exists`,
    });
  }

  // Prisma foreign-key violation (e.g. bad resource_id / department_id)
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  // Prisma serialization conflict / transaction isolation failure
  if (err.code === 'P2034') {
    return res.status(409).json({ error: 'Concurrent booking conflict. Please retry your request.' });
  }

  const status = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    details: err.message,
    ...(isDev && { stack: err.stack }),
  });
};
