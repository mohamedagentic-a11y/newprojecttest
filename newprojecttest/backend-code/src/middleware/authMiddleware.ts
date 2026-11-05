import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AppRole =
  | 'Corporate Traveler'
  | 'Leisure Passenger'
  | 'Travel Operations Specialist';

export interface JwtPayload {
  passenger_id: string;
  tier_status: string;
  preferred_language: string;
  role: AppRole;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Missing or malformed Authorization header. Bearer token required.',
      meta: {
        requestId: (req.headers['x-request-id'] as string) || null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  if (!token) {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Bearer token is empty.',
      meta: {
        requestId: (req.headers['x-request-id'] as string) || null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Server configuration error.',
      meta: {
        requestId: (req.headers['x-request-id'] as string) || null,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!decoded.passenger_id) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid token payload: missing passenger_id.',
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const validRoles: AppRole[] = [
      'Corporate Traveler',
      'Leisure Passenger',
      'Travel Operations Specialist',
    ];

    if (decoded.role && !validRoles.includes(decoded.role)) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid token payload: unrecognized role.',
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    req.user = {
      passenger_id: decoded.passenger_id,
      tier_status: decoded.tier_status ?? '',
      preferred_language: decoded.preferred_language ?? 'en',
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Token has expired. Please refresh your session.',
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid token. Authentication required.',
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Authentication failed.',
      meta: {
        requestId: (req.headers['x-request-id'] as string) || null,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Authentication required.',
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        code: 403,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
        meta: {
          requestId: (req.headers['x-request-id'] as string) || null,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}