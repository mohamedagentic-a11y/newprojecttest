import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: number | string;
  details?: Record<string, unknown>;
  isOperational?: boolean;
}

export interface ErrorEnvelope {
  status: 'error';
  code: number;
  message: string;
  details?: Record<string, unknown>;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode =
    err.statusCode ??
    err.status ??
    (typeof err.code === 'number' && err.code >= 100 && err.code < 600
      ? err.code
      : undefined) ??
    500;

  const httpStatus = typeof statusCode === 'number' ? statusCode : 500;

  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? `req_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  const timestamp = new Date().toISOString();

  const isProduction = process.env.NODE_ENV === 'production';

  let message: string;
  if (isProduction && httpStatus === 500 && !err.isOperational) {
    message = 'An unexpected error occurred. Please try again later.';
  } else {
    message = err.message || 'Internal Server Error';
  }

  const envelope: ErrorEnvelope = {
    status: 'error',
    code: httpStatus,
    message,
    meta: {
      requestId,
      timestamp,
    },
  };

  if (err.details && Object.keys(err.details).length > 0) {
    envelope.details = err.details;
  }

  if (!isProduction || err.isOperational) {
    if (httpStatus === 500 && !isProduction) {
      console.error('[ErrorHandler] Unhandled error:', {
        message: err.message,
        stack: err.stack,
        requestId,
        path: req.path,
        method: req.method,
      });
    }
  } else {
    console.error('[ErrorHandler] Internal server error:', {
      message: err.message,
      stack: err.stack,
      requestId,
      path: req.path,
      method: req.method,
    });
  }

  res.setHeader('X-Request-Id', requestId);
  res.status(httpStatus).json(envelope);
}

export function createAppError(
  message: string,
  statusCode: number,
  details?: Record<string, unknown>,
  isOperational = true
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = statusCode;
  error.details = details;
  error.isOperational = isOperational;
  return error;
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = createAppError(
    `The requested resource was not found: ${req.method} ${req.originalUrl}`,
    404,
    { path: req.originalUrl, method: req.method }
  );
  next(error);
}