import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { pool } from './db/pool';
import { errorHandler } from './middleware/errorHandler';
import { auditMiddleware } from './middleware/auditMiddleware';
import { authRouter } from './routes/authRoutes';
import { passengerRouter } from './routes/passengerRoutes';
import { flightRouter } from './routes/flightRoutes';
import { bookingRouter } from './routes/bookingRoutes';
import { loyaltyRouter } from './routes/loyaltyRoutes';
import { baggageRouter } from './routes/baggageRoutes';
import { localizationRouter } from './routes/localizationRoutes';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins: string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin '${origin}' is not allowed`));
    },
    credentials: true,
  })
);

// ── Security & body parsing ───────────────────────────────────────────────────
app.use(helmet());
app.use(express.json());

// ── Global rate limiter — 100 req / min ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests. Please try again later.',
  },
});

// ── Search-specific rate limiter — 30 req / min ──────────────────────────────
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Search rate limit exceeded. Please slow down.',
  },
});

app.use('/api/v1', globalLimiter);

// ── Audit logging ─────────────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── Routers ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/passengers', passengerRouter);
app.use('/api/v1/flights', searchLimiter, flightRouter);
app.use('/api/v1/bookings', searchLimiter, bookingRouter);
app.use('/api/v1/loyalty', loyaltyRouter);
app.use('/api/v1/baggage', baggageRouter);
app.use('/api/v1/localization', localizationRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    code: 404,
    message: 'The requested resource was not found.',
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

async function start(): Promise<void> {
  // Verify database connectivity before accepting traffic
  try {
    const client = await pool.connect();
    client.release();
    console.log('PostgreSQL connection established.');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`SkyWings API server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Unexpected startup error:', err);
  process.exit(1);
});

export { app };