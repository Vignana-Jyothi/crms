const axios = require('axios');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const prisma = require('../config/prisma');

// "Who are you?" — SSO Integration
// Verifies the userToken cookie with auth-server, then finds/auto-provisions user.
module.exports = async function authenticate(req, res, next) {
  try {
    const token = req.cookies.userToken || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
      return next(ApiError.unauthorized('Missing or malformed userToken cookie'));
    }

    // Verify token with auth-server
    const response = await axios.get(`${env.authUrl}/verify-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status !== 200 || !response.data.user) {
      return next(ApiError.unauthorized('Invalid or expired token'));
    }

    const ssoUser = response.data.user; // { email, name, picture }

    // Check if user exists in database
    let dbUser = await prisma.user.findUnique({
      where: { email: ssoUser.email }
    });

    // Auto-provision user if they don't exist
    if (!dbUser) {
      // Find the 'Requester' role ID as default
      const requesterRole = await prisma.role.findUnique({
        where: { roleName: 'Requester' }
      });

      dbUser = await prisma.user.create({
        data: {
          email: ssoUser.email,
          name: ssoUser.name,
          phone: 'Not Provided',
          roleId: requesterRole ? requesterRole.roleId : null,
          status: 'Active'
        }
      });
    }

    req.auth = {
      userId: dbUser.userId,
      roleId: dbUser.roleId,
      departmentId: dbUser.departmentId,
    };

    // Keep req.user for backward compatibility if needed, containing rich profile
    req.user = dbUser;

    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};
