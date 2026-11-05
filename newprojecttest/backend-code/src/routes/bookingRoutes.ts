import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createBookingHandler,
  rebookFlightHandler,
  checkInHandler,
  boardingPassHandler,
  auditMiddleware,
} from '../controllers/bookingController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const bookingMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests. Please try again later.',
  },
});

router.post(
  '/',
  authMiddleware,
  bookingMutationLimiter,
  auditMiddleware,
  createBookingHandler,
);

router.put(
  '/:id/rebook',
  authMiddleware,
  bookingMutationLimiter,
  auditMiddleware,
  rebookFlightHandler,
);

router.get(
  '/:id/checkin',
  authMiddleware,
  auditMiddleware,
  checkInHandler,
);

router.get(
  '/:id/boarding-pass',
  authMiddleware,
  auditMiddleware,
  boardingPassHandler,
);

export default router;