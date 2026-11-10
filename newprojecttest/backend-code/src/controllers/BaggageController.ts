import { Request, Response, NextFunction } from 'express';
import { BaggageService, ClaimValidationError, SubmitClaimInput } from '../services/BaggageService';

const ALLOWED_IMAGE_MIME_PREFIXES = ['data:image/jpeg', 'data:image/png', 'data:image/gif', 'data:image/webp', 'data:image/bmp'];
const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file encoded in base64 chars ~= 7MB base64, check char length

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

function successEnvelope(data: unknown) {
  return {
    status: 'success',
    data,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function errorEnvelope(code: number, message: string, details?: object) {
  return {
    status: 'error',
    code,
    message,
    ...(details ? { details } : {}),
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function validateFileList(files: unknown[]): string[] {
  const errors: string[] = [];

  if (files.length > MAX_FILES) {
    errors.push(`Maximum ${MAX_FILES} files allowed per claim.`);
  }

  files.forEach((file, index) => {
    if (typeof file !== 'string') {
      errors.push(`File at index ${index} must be a base64-encoded string.`);
      return;
    }

    const isImage = ALLOWED_IMAGE_MIME_PREFIXES.some((prefix) => file.startsWith(prefix));
    if (!isImage) {
      errors.push(
        `File at index ${index} has an unsupported format. Only JPEG, PNG, GIF, WEBP, and BMP images are accepted.`
      );
    }

    // Approximate size check: base64 string length * 0.75 gives approximate byte size
    const approximateBytes = file.length * 0.75;
    if (approximateBytes > MAX_FILE_SIZE_BYTES) {
      errors.push(`File at index ${index} exceeds the maximum allowed size of 5 MB.`);
    }
  });

  return errors;
}

export class BaggageController {
  private baggageService: BaggageService;

  constructor(baggageService: BaggageService) {
    this.baggageService = baggageService;
  }

  submitClaim = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { pnr, incidentType, description, files } = req.body;

      // Extract passenger_id from JWT payload (set by auth middleware)
      const passenger_id: string | undefined = (req as Request & { user?: { passenger_id?: string } }).user
        ?.passenger_id;

      const fieldErrors: { field: string; message: string }[] = [];

      if (!passenger_id) {
        res.status(401).json(errorEnvelope(401, 'Authentication required. passenger_id not found in token.'));
        return;
      }

      if (!pnr || typeof pnr !== 'string' || pnr.trim() === '') {
        fieldErrors.push({ field: 'pnr', message: 'PNR is required.' });
      }

      if (!incidentType || typeof incidentType !== 'string' || incidentType.trim() === '') {
        fieldErrors.push({ field: 'incidentType', message: 'Incident type is required.' });
      }

      if (!description || typeof description !== 'string' || description.trim() === '') {
        fieldErrors.push({ field: 'description', message: 'Description is required.' });
      }

      if (!Array.isArray(files)) {
        fieldErrors.push({ field: 'files', message: 'Files must be an array of base64-encoded images.' });
      } else {
        const fileErrors = validateFileList(files);
        fileErrors.forEach((msg) => fieldErrors.push({ field: 'files', message: msg }));
      }

      if (fieldErrors.length > 0) {
        res.status(400).json(
          errorEnvelope(400, 'Validation failed.', {
            errors: fieldErrors,
          })
        );
        return;
      }

      const input: SubmitClaimInput = {
        passenger_id,
        pnr: (pnr as string).trim(),
        incident_type: (incidentType as string).trim(),
        description: (description as string).trim(),
        files: files as string[],
      };

      const claim = await this.baggageService.submitClaim(input);

      res.status(201).json(successEnvelope(claim));
    } catch (err) {
      if (err instanceof ClaimValidationError) {
        res.status(422).json(
          errorEnvelope(422, 'Claim validation failed.', {
            errors: err.errors,
          })
        );
        return;
      }

      console.error('[BaggageController.submitClaim] Unexpected error:', err);
      res.status(500).json(errorEnvelope(500, 'An unexpected error occurred while submitting the claim.'));
    }
  };

  getClaimStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string' || id.trim() === '') {
        res.status(400).json(errorEnvelope(400, 'Claim ID is required.'));
        return;
      }

      const claim = await this.baggageService.getClaimStatus(id.trim());

      if (!claim) {
        res.status(404).json(errorEnvelope(404, `Claim with ID '${id}' not found.`));
        return;
      }

      res.status(200).json(successEnvelope(claim));
    } catch (err) {
      console.error('[BaggageController.getClaimStatus] Unexpected error:', err);
      res.status(500).json(errorEnvelope(500, 'An unexpected error occurred while retrieving the claim.'));
    }
  };
}