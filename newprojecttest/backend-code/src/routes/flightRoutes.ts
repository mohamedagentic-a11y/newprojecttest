import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { searchFlights } from '../controllers/flightController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const flightRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests to flight search. Please try again later.',
    meta: {
      requestId: 'rate-limit',
      timestamp: new Date().toISOString(),
    },
  },
});

router.get('/search', authMiddleware, flightRateLimiter, searchFlights);

export default router;