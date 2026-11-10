import { Router } from 'express';
import { getProfile, updateProfile, exportPassengerData } from '../controllers/passengerController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/export', authMiddleware, exportPassengerData);

export default router;