import { Router } from 'express';
import multer from 'multer';
import { BaggageController } from '../controllers/BaggageController';
import { authenticateToken } from '../middleware/authMiddleware';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const baggageRouter = Router();
const controller = new BaggageController();

baggageRouter.post(
  '/claims',
  authenticateToken,
  upload.array('files'),
  controller.submitClaim.bind(controller)
);

baggageRouter.get(
  '/claims/:id',
  authenticateToken,
  controller.getClaimStatus.bind(controller)
);

export { baggageRouter };