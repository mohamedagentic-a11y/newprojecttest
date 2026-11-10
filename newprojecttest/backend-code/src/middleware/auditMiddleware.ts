import { Request, Response, NextFunction } from 'express';
import { AuditRepository, AuditLogEntry } from '../repositories/AuditRepository';

const auditRepo = new AuditRepository();

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ACTION_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /^\/auth\/login$/i, action: 'AUTH_LOGIN' },
  { pattern: /^\/auth\/logout$/i, action: 'AUTH_LOGOUT' },
  { pattern: /^\/auth\/refresh$/i, action: 'AUTH_REFRESH' },
  { pattern: /^\/bookings\/[^/]+\/rebook$/i, action: 'BOOKING_REBOOK' },
  { pattern: /^\/bookings$/i, action: 'BOOKING_CREATE' },
  { pattern: /^\/bookings\/[^/]+$/i, action: 'BOOKING_UPDATE' },
  { pattern: /^\/passengers\/profile$/i, action: 'PASSENGER_PROFILE_UPDATE' },
  { pattern: /^\/loyalty\/redeem$/i, action: 'LOYALTY_REDEEM' },
  { pattern: /^\/baggage\/claims$/i, action: 'BAGGAGE_CLAIM_CREATE' },
  { pattern: /^\/baggage\/claims\/[^/]+$/i, action: 'BAGGAGE_CLAIM_UPDATE' },
];

function resolveAction(method: string, path: string): string | null {
  const normalizedPath = path.replace(/^\/api\/v\d+/, '').replace(/^\/api/, '');

  if (method === 'GET' && !/login|logout|refresh/.test(normalizedPath)) {
    return null;
  }

  for (const { pattern, action } of ACTION_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return action;
    }
  }

  if (STATE_CHANGING_METHODS.has(method)) {
    const segment = normalizedPath.split('/').filter(Boolean)[0] ?? 'UNKNOWN';
    return `${method}_${segment.toUpperCase()}`;
  }

  return null;
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
}

function extractPassengerId(req: Request): string | null {
  const user = (req as Request & { user?: { passenger_id?: string; id?: string } }).user;
  if (user) {
    return user.passenger_id ?? user.id ?? null;
  }
  return null;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const path = req.path;
  const action = resolveAction(method, path);

  if (!action) {
    next();
    return;
  }

  const ip = extractIp(req);
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let auditWritten = false;

  async function writeAuditLog(statusCode: number): Promise<void> {
    if (auditWritten) return;
    auditWritten = true;

    const outcome = statusCode >= 200 && statusCode < 300
      ? 'SUCCESS'
      : statusCode >= 400 && statusCode < 500
        ? 'CLIENT_ERROR'
        : statusCode >= 500
          ? 'SERVER_ERROR'
          : 'UNKNOWN';

    const passengerId = extractPassengerId(req);

    const entry: AuditLogEntry = {
      action,
      ip_address: ip,
      outcome,
      passenger_id: passengerId,
    };

    try {
      await auditRepo.insertAuditLog(entry);
    } catch (err) {
      console.error('[auditMiddleware] Failed to write audit log:', err);
    }
  }

  res.json = function (body?: unknown): Response {
    writeAuditLog(res.statusCode).catch((err) => {
      console.error('[auditMiddleware] Async audit write error:', err);
    });
    return originalJson(body);
  };

  res.send = function (body?: unknown): Response {
    writeAuditLog(res.statusCode).catch((err) => {
      console.error('[auditMiddleware] Async audit write error:', err);
    });
    return originalSend(body);
  };

  res.on('finish', () => {
    if (!auditWritten) {
      writeAuditLog(res.statusCode).catch((err) => {
        console.error('[auditMiddleware] Finish-event audit write error:', err);
      });
    }
  });

  next();
}