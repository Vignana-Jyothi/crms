const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ApiError = require('../utils/ApiError');

const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3115';

// "Who are you?" — Section 13 of the architecture doc.
// Verifies the JWT via SSO auth-server and attaches { userId, roleId, departmentId }
// to req.auth. Auto-provisions user if they don't exist.
module.exports = async function authenticate(req, res, next) {
  let token = req.cookies?.userToken;

  if (!token) {
    const header = req.headers.authorization || '';
    const [scheme, headerToken] = header.split(' ');
    if (scheme === 'Bearer') {
      token = headerToken;
    }
  }

  if (!token) {
    return next(ApiError.unauthorized('Missing token in cookies or Authorization header'));
  }

  try {
    const response = await axios.get(`${AUTH_URL}/verify-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status !== 200) {
      return next(ApiError.unauthorized('Invalid token from auth server'));
    }

    const { email, name } = response.data.user;

    let user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, department: true }
    });

    if (!user) {
      // Auto-provision user
      const isHead = email.toLowerCase().includes('head');
      const roleName = isHead ? 'Department Admin' : 'Requester';
      
      const role = await prisma.role.findUnique({ where: { roleName } });
      if (!role) {
        return next(ApiError.internal(`Default role '${roleName}' not found in DB`));
      }

      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          passwordHash: 'SSO_MANAGED', // Dummy hash for SSO accounts
          roleId: role.roleId
        },
        include: { role: true, department: true }
      });
    }

    req.auth = {
      userId: user.userId,
      roleId: user.roleId,
      departmentId: user.departmentId,
    };
    
    next();
  } catch (err) {
    console.error('SSO Authentication failed:', err.message);
    next(ApiError.unauthorized('Authentication failed via SSO'));
  }
};
