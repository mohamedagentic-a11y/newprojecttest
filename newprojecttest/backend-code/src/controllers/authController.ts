import { Request, Response, NextFunction } from 'express';
import {
  login,
  verifyRefreshToken,
  rotateRefreshToken,
  checkLockout,
  recordFailedAttempt,
  resetLoginAttempts,
} from '../services/authService';
import auditMiddleware, { AuditableRequest } from '../middleware/auditMiddleware';

const REFRESH_COOKIE_NAME = 'refreshToken';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function buildMeta(req: Request) {
  return {
    requestId: (req.headers['x-request-id'] as string) || `req_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

export async function loginHandler(
  req: Request & AuditableRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({
      status: 'error',
      code: 400,
      message: 'email and password are required.',
      meta: buildMeta(req),
    });
    return;
  }

  try {
    // Check account lockout before attempting login
    const lockout = await checkLockout(email);
    if (lockout && (lockout as any).locked) {
      req.auditPassengerId = null;
      req.auditOutcome = 'failure';
      res.status(423).json({
        status: 'error',
        code: 423,
        message: 'Account locked due to too many failed attempts. Please try again later.',
        meta: buildMeta(req),
      });
      return;
    }

    const result = await login(email, password);

    if (!result) {
      await recordFailedAttempt(email);
      req.auditPassengerId = null;
      req.auditOutcome = 'failure';
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid email or password.',
        meta: buildMeta(req),
      });
      return;
    }

    const { tokens, tierStatus, passenger_id, preferred_language, role } = result;

    await resetLoginAttempts(email);

    req.auditPassengerId = passenger_id;
    req.auditOutcome = 'success';

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/auth/refresh',
    });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: tokens.accessToken,
        tierStatus,
        passenger_id,
        preferred_language,
        role,
      },
      meta: buildMeta(req),
    });
  } catch (err: any) {
    // Treat thrown lockout errors as 423
    if (err?.message?.toLowerCase().includes('locked')) {
      req.auditPassengerId = null;
      req.auditOutcome = 'failure';
      res.status(423).json({
        status: 'error',
        code: 423,
        message: err.message,
        meta: buildMeta(req),
      });
      return;
    }

    // Treat authentication failures as 401
    if (
      err?.message?.toLowerCase().includes('invalid') ||
      err?.message?.toLowerCase().includes('password') ||
      err?.message?.toLowerCase().includes('not found')
    ) {
      try {
        await recordFailedAttempt(email);
      } catch (_) {
        // best effort
      }
      req.auditPassengerId = null;
      req.auditOutcome = 'failure';
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid email or password.',
        meta: buildMeta(req),
      });
      return;
    }

    req.auditPassengerId = null;
    req.auditOutcome = 'failure';
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'An internal error occurred during authentication.',
      meta: buildMeta(req),
    });
  }
}

export async function refreshHandler(
  req: Request & AuditableRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Refresh token missing.',
      meta: buildMeta(req),
    });
    return;
  }

  try {
    const payload = await verifyRefreshToken(token);

    if (!payload) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Invalid or expired refresh token.',
        meta: buildMeta(req),
      });
      return;
    }

    const rotated = await rotateRefreshToken(token, payload as any);

    if (!rotated) {
      res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Could not rotate refresh token.',
        meta: buildMeta(req),
      });
      return;
    }

    const { tokens, passenger_id, preferred_language, role, tierStatus } = rotated as any;

    req.auditPassengerId = passenger_id;
    req.auditOutcome = 'success';

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/auth/refresh',
    });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: tokens.accessToken,
        tierStatus,
        passenger_id,
        preferred_language,
        role,
      },
      meta: buildMeta(req),
    });
  } catch (err: any) {
    req.auditPassengerId = null;
    req.auditOutcome = 'failure';
    res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Invalid or expired refresh token.',
      meta: buildMeta(req),
    });
  }
}