import { Router } from 'express';
import { PassengerController } from '../controllers/PassengerController';
import { authenticateToken } from '../middleware/authMiddleware';

const passengerRouter = Router();
const controller = new PassengerController();

passengerRouter.get('/profile', authenticateToken, (req, res, next) => controller.getProfile(req, res, next));
passengerRouter.put('/profile', authenticateToken, (req, res, next) => controller.updateProfile(req, res, next));
passengerRouter.get('/export', authenticateToken, (req, res, next) => controller.exportData(req, res, next));

export { passengerRouter };