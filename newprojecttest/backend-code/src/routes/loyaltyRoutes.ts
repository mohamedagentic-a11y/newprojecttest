import { Router } from 'express';
import { getLoyaltyBalance, redeemLoyaltyMiles } from '../controllers/loyaltyController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/balance', authMiddleware, getLoyaltyBalance);
router.post('/redeem', authMiddleware, redeemLoyaltyMiles);

export default router;