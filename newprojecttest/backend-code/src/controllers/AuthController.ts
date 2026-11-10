import { Request, Response, NextFunction } from 'express';
import { PassengerService } from '../services/PassengerService';
import { TokenService } from '../services/TokenService';

const passengerService = new PassengerService();

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11);
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[REDACTED]';
  const visible = local.length > 2 ? local.substring(0, 2) : local.substring(0, 1);
  return `${visible}***@${domain}`;
}

function writeAuditLog(params: {
  userId: string | null;
  ip: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  meta?: Record<string, unknown>;
}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    userId: params.userId,
    ip: params.ip,
    action: params.action,
    resource: params.resource,
    outcome: params.outcome,
    meta: params.meta ?? {},
  };
  // Structured immutable audit log — write to stdout for aggregation pipeline (WORM)
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export class AuthController {
  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const requestId = generateRequestId();
    const timestamp = new Date().toISOString();
    const ip = getClientIp(req);

    const { email, password } = req.body as { email?: unknown; password?: unknown };

    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({
        status: 'error',
        code: 400,
        message: 'email is required.',
        details: { field: 'email', constraint: 'must be a non-empty string' },
        meta: { requestId, timestamp },
      });
      return;
    }

    if (typeof password !== 'string' || !password) {
      res.status(400).json({
        status: 'error',
        code: 400,
        message: 'password is required.',
        details: { field: 'password', constraint: 'must be a non-empty string' },
        meta: { requestId, timestamp },
      });
      return;
    }

    let authResult: Awaited<ReturnType<typeof passengerService.authenticate>>;

    try {
      authResult = await passengerService.authenticate(email.trim(), password);
    } catch (err: unknown) {
      writeAuditLog({
        userId: null,
        ip,
        action: 'LOGIN',
        resource: '/auth/login',
        outcome: 'failure',
        meta: {
          redactedEmail: redactEmail(email.trim()),
          reason: err instanceof Error ? err.message : 'authentication_failed',
        },
      });

      const isUnauthorized =
        err instanceof Error &&
        (err.message.toLowerCase().includes('invalid') ||
          err.message.toLowerCase().includes('locked') ||
          err.message.toLowerCase().includes('credentials') ||
          err.message.toLowerCase().includes('not found'));

      if (isUnauthorized) {
        res.status(401).json({
          status: 'error',
          code: 401,
          message: 'Invalid email or password.',
          details: null,
          meta: { requestId, timestamp },
        });
        return;
      }

      res.status(500).json({
        status: 'error',
        code: 500,
        message: 'An unexpected error occurred during authentication.',
        details: null,
        meta: { requestId, timestamp },
      });
      return;
    }

    const { profile } = authResult;

    const tokenPayload = {
      passenger_id: profile.passenger_id,
      tier_status: profile.tier_status,
      role: profile.role,
      preferred_language: profile.preferred_language,
    };

    const accessToken = TokenService.signAccessToken(tokenPayload);
    const refreshToken = TokenService.signRefreshToken(profile.passenger_id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/',
    });

    writeAuditLog({
      userId: profile.passenger_id,
      ip,
      action: 'LOGIN',
      resource: '/auth/login',
      outcome: 'success',
      meta: {
        tierStatus: profile.tier_status,
        role: profile.role,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken,
        tierStatus: profile.tier_status,
      },
      meta: { requestId, timestamp },
    });
  }
}