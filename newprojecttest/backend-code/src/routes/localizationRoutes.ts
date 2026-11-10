import { Router } from 'express';
import { getLocalizationConfigHandler } from '../controllers/localizationController';

const router = Router();

router.get('/config', getLocalizationConfigHandler);

export default router;