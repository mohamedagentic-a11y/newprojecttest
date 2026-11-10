import bcrypt from 'bcryptjs';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { query, getClient } from '../db/pool';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export interface TokenPayload {
  passenger_id: string;
  tier_status: string;
  preferred_language: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  tokens: AuthTokens;
  tierStatus: string;
  passenger_id: string;
  preferred_language: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(
  plaintext: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hashed);
}

export function signAccessToken(payload: TokenPayload): string {
  const secret = getRequiredEnv('JWT_ACCESS_SECRET');
  const options: SignOptions = { expiresIn: '30m' };
  return jwt.sign(payload, secret, options);
}

export function signRefreshToken(payload: TokenPayload): string {
  const secret = getRequiredEnv('JWT_REFRESH_SECRET');
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string): TokenPayload & JwtPayload {
  const secret = getRequiredEnv('JWT_ACCESS_SECRET');
  return jwt.verify(token, secret) as TokenPayload & JwtPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & JwtPayload {
  const secret = getRequiredEnv('JWT_REFRESH_SECRET');
  return jwt.verify(token, secret) as TokenPayload & JwtPayload;
}

export async function checkLockout(email: string): Promise<void> {
  const result = await query(
    `SELECT login_attempts, lockout_until
     FROM passengers
     WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    // Let the caller decide whether the user exists; don't leak info
    return;
  }

  const { login_attempts, lockout_until } = result.rows[0];

  if (lockout_until && new Date(lockout_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(lockout_until).getTime() - Date.now()) / 60000
    );
    throw new Error(
      `Account locked due to too many failed attempts. Try again in ${remaining} minute(s).`
    );
  }

  if (login_attempts >= MAX_LOGIN_ATTEMPTS && !lockout_until) {
    // Edge case: attempts at max but lockout_until cleared — reset
    await query(
      `UPDATE passengers SET login_attempts = 0 WHERE email = $1`,
      [email]
    );
  }
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const result = await query(
    `UPDATE passengers
     SET login_attempts = login_attempts + 1,
         lockout_until = CASE
           WHEN login_attempts + 1 >= $1
           THEN NOW() + ($2 || ' minutes')::INTERVAL
           ELSE NULL
         END
     WHERE email = $3
     RETURNING login_attempts, lockout_until`,
    [MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES.toString(), email]
  );

  if (result.rows.length > 0) {
    const { login_attempts } = result.rows[0];
    if (login_attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error(
        `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`
      );
    }
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await query(
    `UPDATE passengers
     SET login_attempts = 0,
         lockout_until = NULL
     WHERE email = $1`,
    [email]
  );
}

export async function storeRefreshToken(
  passengerId: string,
  token: string
): Promise<void> {
  const hashedToken = await bcrypt.hash(token, BCRYPT_SALT_ROUNDS);
  await query(
    `INSERT INTO refresh_tokens (passenger_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', NOW())
     ON CONFLICT (passenger_id)
     DO UPDATE SET token_hash = EXCLUDED.token_hash,
                   expires_at = EXCLUDED.expires_at,
                   created_at = EXCLUDED.created_at`,
    [passengerId, hashedToken]
  );
}

export async function validateStoredRefreshToken(
  passengerId: string,
  token: string
): Promise<boolean> {
  const result = await query(
    `SELECT token_hash, expires_at
     FROM refresh_tokens
     WHERE passenger_id = $1 AND expires_at > NOW()`,
    [passengerId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const { token_hash } = result.rows[0];
  return bcrypt.compare(token, token_hash);
}

export async function revokeRefreshToken(passengerId: string): Promise<void> {
  await query(
    `DELETE FROM refresh_tokens WHERE passenger_id = $1`,
    [passengerId]
  );
}

export async function rotateRefreshToken(
  passengerId: string,
  oldToken: string
): Promise<AuthTokens | null> {
  const isValid = await validateStoredRefreshToken(passengerId, oldToken);
  if (!isValid) {
    return null;
  }

  const passengerResult = await query(
    `SELECT passenger_id, tier_status, preferred_language, role
     FROM passengers
     WHERE passenger_id = $1`,
    [passengerId]
  );

  if (passengerResult.rows.length === 0) {
    return null;
  }

  const passenger = passengerResult.rows[0];
  const payload: TokenPayload = {
    passenger_id: passenger.passenger_id,
    tier_status: passenger.tier_status,
    preferred_language: passenger.preferred_language,
    role: passenger.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(passengerId, refreshToken);

  return { accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  await checkLockout(email);

  const result = await query(
    `SELECT passenger_id, password_hash, tier_status, preferred_language, role, email
     FROM passengers
     WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    // Record a fake delay to prevent timing attacks, but no row to update
    await bcrypt.compare(password, '$2a$12$invalidhashfortimingnormalization00000000000000000000000');
    throw new Error('Invalid email or password.');
  }

  const passenger = result.rows[0];
  const passwordMatch = await comparePassword(password, passenger.password_hash);

  if (!passwordMatch) {
    await recordFailedAttempt(email);
    throw new Error('Invalid email or password.');
  }

  await resetLoginAttempts(email);

  const payload: TokenPayload = {
    passenger_id: passenger.passenger_id,
    tier_status: passenger.tier_status,
    preferred_language: passenger.preferred_language,
    role: passenger.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(passenger.passenger_id, refreshToken);

  return {
    tokens: { accessToken, refreshToken },
    tierStatus: passenger.tier_status,
    passenger_id: passenger.passenger_id,
    preferred_language: passenger.preferred_language,
    role: passenger.role,
  };
}

export async function logout(passengerId: string): Promise<void> {
  await revokeRefreshToken(passengerId);
}