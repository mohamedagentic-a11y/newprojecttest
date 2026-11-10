import { Request, Response, NextFunction } from 'express';
import { PassengerService } from '../services/PassengerService';

const passengerService = new PassengerService();

function generateMeta(req: Request) {
  return {
    requestId: `req_${Math.random().toString(36).substring(2, 10)}`,
    timestamp: new Date().toISOString(),
  };
}

export class PassengerController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId = (req as any).user?.passenger_id;
      if (!passengerId) {
        res.status(401).json({
          status: 'error',
          code: 401,
          message: 'Unauthorized: missing passenger identity.',
          meta: generateMeta(req),
        });
        return;
      }

      const profile = await passengerService.getProfile(passengerId);

      res.status(200).json({
        status: 'success',
        data: profile,
        meta: generateMeta(req),
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId = (req as any).user?.passenger_id;
      if (!passengerId) {
        res.status(401).json({
          status: 'error',
          code: 401,
          message: 'Unauthorized: missing passenger identity.',
          meta: generateMeta(req),
        });
        return;
      }

      const payload = req.body;
      const updatedProfile = await passengerService.updateProfile(passengerId, payload);

      res.status(200).json({
        status: 'success',
        data: updatedProfile,
        meta: generateMeta(req),
      });
    } catch (err) {
      next(err);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId = (req as any).user?.passenger_id;
      if (!passengerId) {
        res.status(401).json({
          status: 'error',
          code: 401,
          message: 'Unauthorized: missing passenger identity.',
          meta: generateMeta(req),
        });
        return;
      }

      const exportJobResult = await passengerService.initiateDataExport(passengerId);

      res.status(202).json({
        status: 'success',
        data: {
          exportJobId: exportJobResult.exportJobId,
          status: exportJobResult.status,
        },
        meta: generateMeta(req),
      });
    } catch (err) {
      next(err);
    }
  }
}