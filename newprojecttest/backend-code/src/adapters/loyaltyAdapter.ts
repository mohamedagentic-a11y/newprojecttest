import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[loyaltyAdapter] Required environment variable "${key}" is not set. ` +
        `Cannot initialise Corporate Finance & Rewards Platform adapter.`
    );
  }
  return value;
}

const LOYALTY_BASE_URL   = requireEnv('LOYALTY_PLATFORM_BASE_URL');
const OAUTH_TOKEN_URL    = requireEnv('LOYALTY_OAUTH_TOKEN_URL');
const OAUTH_CLIENT_ID    = requireEnv('LOYALTY_OAUTH_CLIENT_ID');
const OAUTH_CLIENT_SECRET= requireEnv('LOYALTY_OAUTH_CLIENT_SECRET');
const MTLS_CERT_PATH     = requireEnv('LOYALTY_MTLS_CERT_PATH');
const MTLS_KEY_PATH      = requireEnv('LOYALTY_MTLS_KEY_PATH');
const MTLS_CA_PATH       = requireEnv('LOYALTY_MTLS_CA_PATH');

const RETRY_ATTEMPTS     = parseInt(process.env['LOYALTY_RETRY_ATTEMPTS'] ?? '3', 10);
const RETRY_DELAY_MS     = parseInt(process.env['LOYALTY_RETRY_DELAY_MS']  ?? '500', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MilesTransaction {
  transactionId: string;
  passengerId:   string;
  amount:        number;          // positive = credit, negative = debit
  serviceType:   string;
  timestamp:     string;          // ISO-8601
  status:        'pending' | 'posted' | 'reversed' | 'failed';
  reference?:    string;
}

export interface LoyaltyBalance {
  passengerId:  string;
  tierStatus:   string;
  milesBalance: number;
  pendingMiles: number;
  asOf:         string;
}

export interface ReconciliationResult {
  passengerId:    string;
  matched:        number;
  mismatched:     number;
  created:        number;
  errors:         string[];
  processedAt:    string;
}

export interface AuditRecord {
  eventType:    string;
  passengerId:  string;
  payload:      unknown;
  outcome:      'success' | 'failure';
  error?:       string;
  timestamp:    string;
}

type AuditHook = (record: AuditRecord) => void | Promise<void>;

// ---------------------------------------------------------------------------
// In-memory OAuth token cache
// ---------------------------------------------------------------------------
interface TokenCache {
  accessToken: string;
  expiresAt:   number; // epoch-ms
}

let tokenCache: TokenCache | null = null;

// ---------------------------------------------------------------------------
// mTLS HTTPS agent (re-used across all requests)
// ---------------------------------------------------------------------------
function buildHttpsAgent(): https.Agent {
  return new https.Agent({
    cert: fs.readFileSync(path.resolve(MTLS_CERT_PATH)),
    key:  fs.readFileSync(path.resolve(MTLS_KEY_PATH)),
    ca:   fs.readFileSync(path.resolve(MTLS_CA_PATH)),
    rejectUnauthorized: true,
  });
}

const httpsAgent = buildHttpsAgent();

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const loyaltyClient: AxiosInstance = axios.create({
  baseURL: LOYALTY_BASE_URL,
  timeout: 15_000,
  httpsAgent,
});

// ---------------------------------------------------------------------------
// OAuth 2.0 – client-credentials grant over mTLS
// ---------------------------------------------------------------------------
async function fetchOAuthToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    scope:         'loyalty:read loyalty:write loyalty:reconcile',
  });

  const response = await axios.post<{
    access_token: string;
    expires_in:   number;
  }>(OAUTH_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    httpsAgent,
    timeout: 10_000,
  });

  const { access_token, expires_in } = response.data;
  tokenCache = {
    accessToken: access_token,
    expiresAt:   now + expires_in * 1_000,
  };
  return access_token;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn:        () => Promise<T>,
  attempts:  number = RETRY_ATTEMPTS,
  delayMs:   number = RETRY_DELAY_MS,
  label:     string = 'operation'
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === attempts;
      if (!isLast) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[loyaltyAdapter] "${label}" failed (attempt ${attempt}/${attempts}). ` +
            `Retrying in ${backoff}ms…`,
          err
        );
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Audit hooks registry
// ---------------------------------------------------------------------------
const auditHooks: AuditHook[] = [];

export function registerAuditHook(hook: AuditHook): void {
  auditHooks.push(hook);
}

async function emitAudit(record: AuditRecord): Promise<void> {
  for (const hook of auditHooks) {
    try {
      await hook(record);
    } catch (err) {
      console.error('[loyaltyAdapter] Audit hook threw:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Authorised request helper
// ---------------------------------------------------------------------------
async function authorisedRequest<T>(
  config: AxiosRequestConfig
): Promise<T> {
  const token = await fetchOAuthToken();
  const response = await loyaltyClient.request<T>({
    ...config,
    headers: {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Public adapter surface
// ---------------------------------------------------------------------------

/**
 * Fetch the current loyalty balance for a passenger from the external ledger.
 */
export async function getLoyaltyBalance(
  passengerId: string
): Promise<LoyaltyBalance> {
  const eventType = 'getLoyaltyBalance';
  try {
    const data = await withRetry(
      () =>
        authorisedRequest<LoyaltyBalance>({
          method: 'GET',
          url:    `/passengers/${encodeURIComponent(passengerId)}/balance`,
        }),
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );
    await emitAudit({
      eventType,
      passengerId,
      payload:   { passengerId },
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });
    return data;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload:   { passengerId },
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Retrieve transaction history from the external loyalty ledger.
 */
export async function getTransactionHistory(
  passengerId: string,
  cursor?: string,
  limit  = 20
): Promise<{ transactions: MilesTransaction[]; nextCursor?: string }> {
  const eventType = 'getTransactionHistory';
  try {
    const params: Record<string, string | number> = { limit };
    if (cursor) params['cursor'] = cursor;

    const data = await withRetry(
      () =>
        authorisedRequest<{ transactions: MilesTransaction[]; nextCursor?: string }>({
          method: 'GET',
          url:    `/passengers/${encodeURIComponent(passengerId)}/transactions`,
          params,
        }),
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );
    await emitAudit({
      eventType,
      passengerId,
      payload:   { passengerId, cursor, limit },
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });
    return data;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload:   { passengerId, cursor, limit },
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Post a miles debit to the external loyalty ledger (e.g. redemption).
 */
export async function postMilesDebit(
  passengerId: string,
  amount:      number,
  serviceType: string,
  reference?:  string
): Promise<MilesTransaction> {
  const eventType = 'postMilesDebit';
  const payload = { passengerId, amount, serviceType, reference };
  try {
    const data = await withRetry(
      () =>
        authorisedRequest<MilesTransaction>({
          method: 'POST',
          url:    `/passengers/${encodeURIComponent(passengerId)}/transactions/debit`,
          data:   payload,
        }),
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });
    return data;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Post a miles credit to the external loyalty ledger (e.g. earning after a flight).
 */
export async function postMilesCredit(
  passengerId: string,
  amount:      number,
  serviceType: string,
  reference?:  string
): Promise<MilesTransaction> {
  const eventType = 'postMilesCredit';
  const payload = { passengerId, amount, serviceType, reference };
  try {
    const data = await withRetry(
      () =>
        authorisedRequest<MilesTransaction>({
          method: 'POST',
          url:    `/passengers/${encodeURIComponent(passengerId)}/transactions/credit`,
          data:   payload,
        }),
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });
    return data;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Reverse a previously posted miles transaction.
 */
export async function reverseTransaction(
  passengerId:   string,
  transactionId: string,
  reason:        string
): Promise<MilesTransaction> {
  const eventType = 'reverseTransaction';
  const payload = { passengerId, transactionId, reason };
  try {
    const data = await withRetry(
      () =>
        authorisedRequest<MilesTransaction>({
          method: 'POST',
          url:    `/passengers/${encodeURIComponent(passengerId)}/transactions/${encodeURIComponent(transactionId)}/reverse`,
          data:   { reason },
        }),
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });
    return data;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Reconcile a local list of miles transactions against the external ledger.
 * Identifies matched, mismatched and missing records; creates stubs for missing
 * entries in the external system.
 */
export async function reconcileTransactions(
  passengerId:        string,
  localTransactions:  MilesTransaction[]
): Promise<ReconciliationResult> {
  const eventType = 'reconcileTransactions';
  const payload = { passengerId, count: localTransactions.length };

  try {
    const result = await withRetry(
      async (): Promise<ReconciliationResult> => {
        // 1. Fetch the external ledger page by page.
        const externalTxns: MilesTransaction[] = [];
        let cursor: string | undefined;
        do {
          const page = await authorisedRequest<{
            transactions: MilesTransaction[];
            nextCursor?:  string;
          }>({
            method: 'GET',
            url:    `/passengers/${encodeURIComponent(passengerId)}/transactions`,
            params: { limit: 50, ...(cursor ? { cursor } : {}) },
          });
          externalTxns.push(...page.transactions);
          cursor = page.nextCursor;
        } while (cursor);

        // 2. Build a lookup map by transactionId.
        const externalMap = new Map<string, MilesTransaction>(
          externalTxns.map((t) => [t.transactionId, t])
        );

        let matched    = 0;
        let mismatched = 0;
        let created    = 0;
        const errors: string[] = [];

        // 3. Walk local records and compare / create as needed.
        for (const local of localTransactions) {
          const remote = externalMap.get(local.transactionId);
          if (!remote) {
            // Missing in external system – create stub credit/debit.
            try {
              const fn = local.amount >= 0 ? postMilesCredit : postMilesDebit;
              await fn(
                passengerId,
                Math.abs(local.amount),
                local.serviceType,
                local.transactionId
              );
              created++;
            } catch (createErr) {
              errors.push(
                `Failed to create txn ${local.transactionId}: ${String(createErr)}`
              );
            }
          } else if (remote.amount !== local.amount || remote.status !== local.status) {
            mismatched++;
            errors.push(
              `Mismatch on txn ${local.transactionId}: ` +
                `local amount=${local.amount} status=${local.status} vs ` +
                `remote amount=${remote.amount} status=${remote.status}`
            );
          } else {
            matched++;
          }
        }

        return {
          passengerId,
          matched,
          mismatched,
          created,
          errors,
          processedAt: new Date().toISOString(),
        };
      },
      RETRY_ATTEMPTS,
      RETRY_DELAY_MS,
      eventType
    );

    await emitAudit({
      eventType,
      passengerId,
      payload:   { ...payload, result },
      outcome:   'success',
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (err) {
    await emitAudit({
      eventType,
      passengerId,
      payload,
      outcome:   'failure',
      error:     String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}