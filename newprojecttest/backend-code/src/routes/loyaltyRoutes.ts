import { Router } from 'express';
import { LoyaltyController } from '../controllers/LoyaltyController';
import { authenticateToken } from '../middleware/authMiddleware';

const loyaltyRouter = Router();
const loyaltyController = new LoyaltyController();

loyaltyRouter.get(
  '/balance',
  authenticateToken,
  (req, res, next) => loyaltyController.getBalance(req, res, next)
);

loyaltyRouter.post(
  '/redeem',
  authenticateToken,
  (req, res, next) => loyaltyController.redeemMiles(req, res, next)
);

export { loyaltyRouter };