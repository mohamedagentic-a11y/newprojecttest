import { v4 as uuidv4 } from 'uuid';
import { BaggageRepository, BaggageClaim, CreateClaimInput } from '../repositories/BaggageRepository';

const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

const VALID_INCIDENT_TYPES = ['delayed', 'damaged', 'lost', 'pilfered', 'other'];

export interface SubmitClaimInput {
  passenger_id: string;
  pnr: string;
  incident_type: string;
  description: string;
  files: string[]; // base64 data URIs or URLs
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ClaimValidationError extends Error {
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Claim validation failed');
    this.name = 'ClaimValidationError';
    this.errors = errors;
  }
}

function isBase64DataUri(file: string): boolean {
  return /^data:[^;]+;base64,/.test(file);
}

function extractMimeType(dataUri: string): string | null {
  const match = dataUri.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

function extractBase64Payload(dataUri: string): string {
  const commaIndex = dataUri.indexOf(',');
  return commaIndex >= 0 ? dataUri.substring(commaIndex + 1) : dataUri;
}

function getBase64ByteSize(base64: string): number {
  // Remove padding characters to calculate actual byte size
  const padding = (base64.match(/={1,2}$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function validateFiles(files: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (files.length === 0) {
    // Files are optional per the data model, no error
    return errors;
  }

  if (files.length > MAX_FILES) {
    errors.push({
      field: 'files',
      message: `A maximum of ${MAX_FILES} files may be attached per claim.`,
    });
    return errors;
  }

  files.forEach((file, index) => {
    if (isBase64DataUri(file)) {
      const mime = extractMimeType(file);
      if (!mime || !ALLOWED_MIME_PREFIXES.includes(mime)) {
        errors.push({
          field: `files[${index}]`,
          message: `File at index ${index} has an unsupported format. Only image files are accepted (JPEG, PNG, GIF, WebP, BMP, TIFF).`,
        });
        return;
      }

      const base64Payload = extractBase64Payload(file);
      const byteSize = getBase64ByteSize(base64Payload);
      if (byteSize > MAX_FILE_SIZE_BYTES) {
        errors.push({
          field: `files[${index}]`,
          message: `File at index ${index} exceeds the maximum allowed size of 10 MB.`,
        });
      }
    } else {
      // Treat as URL — validate it looks like a URL
      try {
        const url = new URL(file);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          errors.push({
            field: `files[${index}]`,
            message: `File at index ${index} must be a valid HTTPS/HTTP URL or a base64 image data URI.`,
          });
        }
      } catch {
        errors.push({
          field: `files[${index}]`,
          message: `File at index ${index} is neither a valid URL nor a base64 image data URI.`,
        });
      }
    }
  });

  return errors;
}

function validateClaimInput(input: SubmitClaimInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.passenger_id || input.passenger_id.trim() === '') {
    errors.push({ field: 'passenger_id', message: 'passenger_id is required.' });
  }

  if (!input.pnr || input.pnr.trim() === '') {
    errors.push({ field: 'pnr', message: 'PNR is required.' });
  } else if (!/^[A-Z0-9]{5,8}$/i.test(input.pnr.trim())) {
    errors.push({ field: 'pnr', message: 'PNR must be 5–8 alphanumeric characters.' });
  }

  if (!input.incident_type || input.incident_type.trim() === '') {
    errors.push({ field: 'incident_type', message: 'incident_type is required.' });
  } else if (!VALID_INCIDENT_TYPES.includes(input.incident_type.trim().toLowerCase())) {
    errors.push({
      field: 'incident_type',
      message: `incident_type must be one of: ${VALID_INCIDENT_TYPES.join(', ')}.`,
    });
  }

  if (!input.description || input.description.trim() === '') {
    errors.push({ field: 'description', message: 'description is required.' });
  } else if (input.description.trim().length < 10) {
    errors.push({ field: 'description', message: 'description must be at least 10 characters.' });
  } else if (input.description.trim().length > 2000) {
    errors.push({ field: 'description', message: 'description must not exceed 2000 characters.' });
  }

  if (!Array.isArray(input.files)) {
    errors.push({ field: 'files', message: 'files must be an array.' });
  } else {
    const fileErrors = validateFiles(input.files);
    errors.push(...fileErrors);
  }

  return errors;
}

function generateTrackingId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `BGC-${timestamp}-${random}`;
}

export class BaggageService {
  private repository: BaggageRepository;

  constructor(repository: BaggageRepository) {
    this.repository = repository;
  }

  async submitClaim(input: SubmitClaimInput): Promise<BaggageClaim> {
    const errors = validateClaimInput(input);
    if (errors.length > 0) {
      throw new ClaimValidationError(errors);
    }

    const trackingId = generateTrackingId();

    const createInput: CreateClaimInput = {
      passenger_id: input.passenger_id.trim(),
      pnr: input.pnr.trim().toUpperCase(),
      incident_type: input.incident_type.trim().toLowerCase(),
      description: input.description.trim(),
      files: input.files,
    };

    // The repository's createClaim is expected to persist the claim; the tracking ID
    // is used as the claim's id when the repository creates the record. If the repository
    // generates its own ID, we store this tracking reference in the returned entity.
    // Per the BaggageRepository contract, createClaim accepts CreateClaimInput and returns
    // BaggageClaim with an auto-assigned id. We pass our generated trackingId through
    // the files array is already set; we rely on the repository for final ID assignment
    // but we also want the caller to receive the tracking number. We inject the trackingId
    // by augmenting the input under a convention-compatible field if the repository supports
    // it, otherwise we return the repository-assigned ID which serves as the claim reference.
    //
    // Because the repository interface only accepts CreateClaimInput (no id field), the
    // repository controls ID generation. We therefore return the BaggageClaim as-is from
    // the repository and treat claim.id as the tracking reference.

    const claim = await this.repository.createClaim(createInput);
    return claim;
  }

  async getClaimStatus(id: string): Promise<BaggageClaim | null> {
    if (!id || id.trim() === '') {
      throw new ClaimValidationError([{ field: 'id', message: 'Claim ID is required.' }]);
    }

    const claim = await this.repository.findById(id.trim());
    return claim;
  }

  async updateClaimStatus(id: string, status: string): Promise<BaggageClaim | null> {
    if (!id || id.trim() === '') {
      throw new ClaimValidationError([{ field: 'id', message: 'Claim ID is required.' }]);
    }

    const validStatuses = ['submitted', 'under_review', 'resolved', 'rejected', 'closed'];
    if (!status || !validStatuses.includes(status.trim().toLowerCase())) {
      throw new ClaimValidationError([
        {
          field: 'status',
          message: `status must be one of: ${validStatuses.join(', ')}.`,
        },
      ]);
    }

    const updated = await this.repository.updateStatus(id.trim(), status.trim().toLowerCase());
    return updated;
  }
}