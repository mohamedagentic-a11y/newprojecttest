import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FlightController } from '../controllers/FlightController';
import { authenticateToken } from '../middleware/authMiddleware';

const flightRouter = Router();

const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many search requests. Please slow down.',
    details: {
      field: 'rate-limit',
      constraint: '30 requests per minute',
    },
  },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json(options.message);
  },
});

const flightController = new FlightController();

flightRouter.get(
  '/search',
  authenticateToken,
  searchRateLimit,
  (req, res, next) => flightController.searchFlights(req, res, next)
);

flightRouter.get(
  '/:id',
  authenticateToken,
  (req, res, next) => flightController.getFlightById(req, res, next)
);

export { flightRouter };