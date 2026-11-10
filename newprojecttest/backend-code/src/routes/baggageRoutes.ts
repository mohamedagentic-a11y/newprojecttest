import { Router } from 'express';
import { submitBaggageClaim, getClaimStatusTimeline } from '../controllers/baggageController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/claims', authMiddleware, submitBaggageClaim);
router.get('/claims/:id', authMiddleware, getClaimStatusTimeline);

export default router;