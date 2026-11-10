import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const VALID_ROLES = [
  'Corporate Traveler',
  'Leisure Passenger',
  'Travel Operations Specialist',
] as const;

type ValidRole = typeof VALID_ROLES[number];

export interface AuthenticatedUser {
  passenger_id: string;
  tier_status: string;
  role: ValidRole;
  preferred_language?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set.');
  }
  return secret;
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>.',
      meta: {
        requestId: req.headers['x-request-id'] ?? null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Server configuration error.',
      meta: {
        requestId: req.headers['x-request-id'] ?? null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Access token has expired.'
        : 'Invalid access token.';

    res.status(401).json({
      status: 'error',
      code: 401,
      message,
      meta: {
        requestId: req.headers['x-request-id'] ?? null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (!decoded.passenger_id || typeof decoded.passenger_id !== 'string') {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Token payload is missing required field: passenger_id.',
      meta: {
        requestId: req.headers['x-request-id'] ?? null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (!decoded.role || !VALID_ROLES.includes(decoded.role as ValidRole)) {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Token payload contains an unrecognised or missing role.',
      meta: {
        requestId: req.headers['x-request-id'] ?? null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  req.user = {
    passenger_id: decoded.passenger_id as string,
    tier_status: (decoded.tier_status as string) ?? '',
    role: decoded.role as ValidRole,
    preferred_language: decoded.preferred_language as string | undefined,
    iat: decoded.iat,
    exp: decoded.exp,
  };

  next();
}

export function authorizeRole(...allowedRoles: ValidRole[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Authentication required.',
        meta: {
          requestId: req.headers['x-request-id'] ?? null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        code: 403,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
        meta: {
          requestId: req.headers['x-request-id'] ?? null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}