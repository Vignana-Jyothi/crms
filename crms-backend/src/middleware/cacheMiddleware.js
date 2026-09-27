const cache = require('../utils/cache');

/**
 * Express middleware to cache responses based on the request URL.
 * 
 * @param {number} duration - Time to live in seconds. If 0 or omitted, uses the default cache TTL.
 */
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = cache.get(key);

    if (cachedBody) {
      // Send the cached response
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedBody);
    } else {
      res.setHeader('X-Cache', 'MISS');
      // Hijack the res.json method to cache the response before sending it
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful responses (HTTP 2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (duration) {
            cache.set(key, body, duration);
          } else {
            cache.set(key, body);
          }
        }
        return originalJson(body);
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;
