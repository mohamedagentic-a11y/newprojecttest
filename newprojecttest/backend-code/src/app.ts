import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/authRoutes';
import passengersRouter from './routes/passengerRoutes';
import flightsRouter from './routes/flightRoutes';
import bookingsRouter from './routes/bookingRoutes';
import loyaltyRouter from './routes/loyaltyRoutes';
import baggageRouter from './routes/baggageRoutes';
import localizationRouter from './routes/localizationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Security headers
app.use(helmet());

// CORS
const allowedOriginsEnv = process.env.CORS_ORIGIN;
const allowedOrigins: string[] = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, server-to-server) only if origin is undefined
      if (!origin) {
        return callback(null, false);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })
);

// Cookie parser & JSON body
app.use(cookieParser());
app.use(express.json());

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests. Please try again later.',
  },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests on this endpoint. Please try again later.',
  },
});

// Apply global rate limiter to all API routes
app.use('/api', globalLimiter);

// Apply stricter rate limiter to flights and bookings
app.use('/api/flights', strictLimiter);
app.use('/api/bookings', strictLimiter);

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/passengers', passengersRouter);
app.use('/api/flights', flightsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/baggage', baggageRouter);
app.use('/api/localization', localizationRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;