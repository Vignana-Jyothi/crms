const axios = require('axios');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/prisma');

// "Who are you?" — Section 13 of the architecture doc.
// Verifies the SSO token via auth-server and fetches/provisions the user.
module.exports = async function authenticate(req, res, next) {
  let token = req.cookies?.userToken;
  if (!token) {
    const header = req.headers.authorization || '';
    const [scheme, hToken] = header.split(' ');
    if (scheme === 'Bearer' && hToken) token = hToken;
  }

  if (!token) {
    return next(ApiError.unauthorized('Missing authentication token'));
  }

  try {
    const authUrl = process.env.AUTH_URL || 'https://auth.vjstartup.com';
    // Send token to auth-server for verification
    const response = await axios.post(`${authUrl}/verify-token`, { token }, {
      headers: { 'x-app-name': 'crms' }
    });

    if (!response.data || !response.data.valid) {
      return next(ApiError.unauthorized('Invalid or expired token via auth-server'));
    }

    const email = response.data.user.email;
    if (!email) {
      return next(ApiError.unauthorized('Token did not contain an email address'));
    }

    // Lookup user by email in the local database
    let user = await prisma.user.findUnique({ where: { email } });

    // Auto-provision if user does not exist (default to Requester role)
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: response.data.user.name || email.split('@')[0],
          phone: '0000000000', // Dummy phone to satisfy NOT NULL constraint
          roleId: 4, // 4 = REQUESTER
          status: 'Active'
        }
      });
    }

    if (user.status !== 'Active') {
      return next(ApiError.forbidden('Your account has been deactivated'));
    }

    req.auth = {
      userId: user.userId,
      roleId: user.roleId,
      departmentId: user.departmentId,
    };
    next();
  } catch (err) {
    console.error("SSO Auth verification failed:", err.message);
    return next(ApiError.unauthorized('Authentication failed or token invalid'));
  }
};
