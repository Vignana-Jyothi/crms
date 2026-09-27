const NodeCache = require('node-cache');

// Initialize cache with standard options. 
// stdTTL: Default time-to-live is 5 minutes (300 seconds).
// checkperiod: Period in seconds used for the automatic delete check interval.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320, useClones: false });

module.exports = cache;
