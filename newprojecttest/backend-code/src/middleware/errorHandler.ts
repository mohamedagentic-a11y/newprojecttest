import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: number | string;
  details?: Record<string, unknown>;
  isOperational?: boolean;
}

interface ErrorEnvelope {
  status: 'error';
  code: number;
  message: string;
  details?: Record<string, unknown>;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

function getRequestId(req: Request): string {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveStatusCode(err: AppError): number {
  if (typeof err.statusCode === 'number' && err.statusCode >= 100 && err.statusCode <= 599) {
    return err.statusCode;
  }
  if (typeof err.status === 'number' && err.status >= 100 && err.status <= 599) {
    return err.status;
  }
  if (typeof err.code === 'number' && err.code >= 100 && err.code <= 599) {
    return err.code;
  }
  return 500;
}

function isSensitiveError(statusCode: number): boolean {
  return statusCode === 500 || statusCode === 503;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = resolveStatusCode(err);
  const requestId = getRequestId(req);
  const timestamp = new Date().toISOString();

  // Log the full error regardless
  const logPayload = {
    requestId,
    timestamp,
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: err.stack,
    details: err.details ?? null,
    isOperational: err.isOperational ?? false,
  };

  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logPayload));
  } else if (statusCode >= 400) {
    console.warn('[WARN]', JSON.stringify(logPayload));
  } else {
    console.info('[INFO]', JSON.stringify(logPayload));
  }

  // Build the public-facing error message; mask internals for 5xx
  const publicMessage =
    isSensitiveError(statusCode) && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'An unexpected error occurred.';

  const envelope: ErrorEnvelope = {
    status: 'error',
    code: statusCode,
    message: publicMessage,
    meta: {
      requestId,
      timestamp,
    },
  };

  // Only expose details for non-500 errors (or in non-production for debugging)
  if (err.details && (!isSensitiveError(statusCode) || process.env.NODE_ENV !== 'production')) {
    envelope.details = err.details;
  }

  res.status(statusCode).json(envelope);
}