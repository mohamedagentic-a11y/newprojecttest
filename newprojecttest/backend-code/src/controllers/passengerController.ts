import { Request, Response, NextFunction } from 'express';
import {
  getPassengerProfile,
  updatePassengerProfile,
  createDataExportJob,
} from '../services/passengerService';

function successEnvelope(data: unknown) {
  return {
    status: 'success',
    data,
    meta: {
      requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
    },
  };
}

function errorEnvelope(code: number, message: string, details?: unknown) {
  return {
    status: 'error',
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    meta: {
      requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * GET /passengers/profile
 * Returns the authenticated passenger's profile.
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const passengerId: string | undefined = (req as any).user?.passenger_id;

    if (!passengerId) {
      res.status(401).json(errorEnvelope(401, 'Unauthorized: missing passenger identity.'));
      return;
    }

    const profile = await getPassengerProfile(passengerId);

    if (!profile) {
      res.status(404).json(errorEnvelope(404, 'Passenger profile not found.'));
      return;
    }

    res.status(200).json(successEnvelope(profile));
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /passengers/profile
 * Updates contact info or document references and triggers DPO validation stub.
 */
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const passengerId: string | undefined = (req as any).user?.passenger_id;

    if (!passengerId) {
      res.status(401).json(errorEnvelope(401, 'Unauthorized: missing passenger identity.'));
      return;
    }

    const { phone, documentUrl } = req.body as {
      phone?: string;
      documentUrl?: string;
    };

    const input: { phone?: string; document_url?: string } = {};
    if (phone !== undefined) {
      input.phone = phone;
    }
    if (documentUrl !== undefined) {
      input.document_url = documentUrl;
    }

    // updatePassengerProfile is expected to trigger the DPO validation stub internally
    const updatedProfile = await updatePassengerProfile(passengerId, input);

    if (!updatedProfile) {
      res.status(404).json(errorEnvelope(404, 'Passenger profile not found or could not be updated.'));
      return;
    }

    res.status(200).json(successEnvelope(updatedProfile));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /passengers/export
 * Initiates a PDPL subject rights data export job, returns 202 Accepted.
 */
export async function exportPassengerData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const passengerId: string | undefined = (req as any).user?.passenger_id;

    if (!passengerId) {
      res.status(401).json(errorEnvelope(401, 'Unauthorized: missing passenger identity.'));
      return;
    }

    const exportJob = await createDataExportJob(passengerId);

    res.status(202).json(
      successEnvelope({
        status: 'processing',
        exportJobId: exportJob.export_job_id,
      })
    );
  } catch (err) {
    next(err);
  }
}