import { Router, Request, Response, NextFunction } from 'express';
import { LocalizationController } from '../controllers/LocalizationController';

const localizationRouter = Router();
const controller = new LocalizationController();

localizationRouter.get('/config', (req: Request, res: Response, next: NextFunction) => {
  controller.getConfig(req, res, next);
});

export { localizationRouter };