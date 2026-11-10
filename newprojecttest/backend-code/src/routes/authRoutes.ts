import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';

const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 429,
    message: 'Too many authentication attempts. Please try again later.',
    details: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
});

const authController = new AuthController();

authRouter.post('/login', authLimiter, (req, res, next) =>
  authController.login(req, res, next)
);

authRouter.post('/refresh', authLimiter, (req, res, next) =>
  authController.login(req, res, next)
);

export { authRouter };