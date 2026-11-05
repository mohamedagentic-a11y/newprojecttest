import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';

export interface AuditableRequest extends Request {
  auditPassengerId?: string | null;
  auditOutcome?: 'success' | 'failure';
}

type ActionType =
  | 'LOGIN'
  | 'BOOKING_CREATE'
  | 'BOOKING_MODIFY'
  | 'PROFILE_UPDATE'
  | 'LOYALTY_REDEEM'
  | 'BAGGAGE_CLAIM_CREATE'
  | 'STATE_MUTATING_REQUEST';

type ResourceAffected =
  | 'auth'
  | 'bookings'
  | 'passengers'
  | 'loyalty'
  | 'baggage';

interface RouteMapping {
  method: string;
  pathPattern: RegExp;
  actionType: ActionType;
  resource: ResourceAffected;
}

const ROUTE_MAPPINGS: RouteMapping[] = [
  {
    method: 'POST',
    pathPattern: /^\/auth\/login$/,
    actionType: 'LOGIN',
    resource: 'auth',
  },
  {
    method: 'POST',
    pathPattern: /^\/bookings$/,
    actionType: 'BOOKING_CREATE',
    resource: 'bookings',
  },
  {
    method: 'PUT',
    pathPattern: /^\/bookings\/[^/]+\/rebook$/,
    actionType: 'BOOKING_MODIFY',
    resource: 'bookings',
  },
  {
    method: 'PUT',
    pathPattern: /^\/passengers\/profile$/,
    actionType: 'PROFILE_UPDATE',
    resource: 'passengers',
  },
  {
    method: 'POST',
    pathPattern: /^\/loyalty\/redeem$/,
    actionType: 'LOYALTY_REDEEM',
    resource: 'loyalty',
  },
  {
    method: 'POST',
    pathPattern: /^\/baggage\/claims$/,
    actionType: 'BAGGAGE_CLAIM_CREATE',
    resource: 'baggage',
  },
];

const STATE_MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function resolveRoute(
  method: string,
  path: string
): { actionType: ActionType; resource: ResourceAffected } | null {
  const normalizedPath = path.split('?')[0];

  for (const mapping of ROUTE_MAPPINGS) {
    if (
      mapping.method === method.toUpperCase() &&
      mapping.pathPattern.test(normalizedPath)
    ) {
      return { actionType: mapping.actionType, resource: mapping.resource };
    }
  }

  if (STATE_MUTATING_METHODS.has(method.toUpperCase())) {
    const resourceMatch = normalizedPath.match(/^\/([^/]+)/);
    const resource = resourceMatch
      ? (resourceMatch[1] as ResourceAffected)
      : ('unknown' as ResourceAffected);
    return {
      actionType: 'STATE_MUTATING_REQUEST',
      resource,
    };
  }

  return null;
}

function extractPassengerId(req: AuditableRequest): string | null {
  if (req.auditPassengerId !== undefined) {
    return req.auditPassengerId;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload && payload.passenger_id) {
          return String(payload.passenger_id);
        }
      }
    } catch {
      // Ignore parse errors; passenger_id will be null
    }
  }

  return null;
}

function extractIpAddress(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0];
    return ips.trim();
  }

  return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
}

async function writeAuditLog(params: {
  passengerId: string | null;
  actionType: ActionType;
  resourceAffected: ResourceAffected | string;
  ipAddress: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const {
    passengerId,
    actionType,
    resourceAffected,
    ipAddress,
    outcome,
    metadata,
  } = params;

  await query(
    `INSERT INTO audit_logs
       (passenger_id, action_type, resource_affected, ip_address, outcome, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      passengerId,
      actionType,
      resourceAffected,
      ipAddress,
      outcome,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export function auditMiddleware(
  req: AuditableRequest,
  res: Response,
  next: NextFunction
): void {
  const resolved = resolveRoute(req.method, req.path);

  if (!resolved) {
    next();
    return;
  }

  const { actionType, resource } = resolved;
  const ipAddress = extractIpAddress(req);

  const originalEnd = res.end.bind(res);

  (res as Response & { end: Function }).end = function (
    this: Response,
    chunk?: unknown,
    encoding?: unknown,
    callback?: unknown
  ): Response {
    const statusCode = res.statusCode;
    const outcome: 'success' | 'failure' =
      req.auditOutcome !== undefined
        ? req.auditOutcome
        : statusCode >= 200 && statusCode < 400
        ? 'success'
        : 'failure';

    const passengerId = extractPassengerId(req);

    const metadata: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      statusCode,
    };

    if (req.params && Object.keys(req.params).length > 0) {
      metadata.params = req.params;
    }

    writeAuditLog({
      passengerId,
      actionType,
      resourceAffected: resource,
      ipAddress,
      outcome,
      metadata,
    }).catch((err) => {
      console.error('[AuditMiddleware] Failed to write audit log:', err);
    });

    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    }
    if (typeof callback === 'function') {
      return originalEnd(chunk, encoding, callback);
    }
    return originalEnd(chunk, encoding);
  };

  next();
}

export default auditMiddleware;