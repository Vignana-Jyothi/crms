const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const masterDataRoutes = require('./modules/masterData/masterData.routes');
const resourcesRoutes = require('./modules/resources/resources.routes');
const bookingsRoutes = require('./modules/bookings/bookings.routes');
const approvalsRoutes = require('./modules/approvals/approvals.routes');
const auditRoutes = require('./modules/audit/audit.routes');

const timetableRoutes = require('./modules/timetable/timetable.routes');

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (env.corsOrigins === '*') return callback(null, true);
    if (Array.isArray(env.corsOrigins) && env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (env.nodeEnv === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// Generic rate limit; tighten further specifically on /auth/login
// if you start seeing credential-stuffing attempts.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 3000 }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'crms-backend' }));

// Section 44: API versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1', masterDataRoutes); // /api/v1/roles, /departments, /blocks, /resource-types
app.use('/api/v1/resources', resourcesRoutes);
app.use('/api/v1/timetable', timetableRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/approvals', approvalsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Must be registered last.
app.use(errorHandler);

module.exports = app;
