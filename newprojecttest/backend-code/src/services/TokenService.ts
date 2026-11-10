import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required but not set.');
}
if (!REFRESH_TOKEN_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required but not set.');
}

export type AppRole =
  | 'Corporate Traveler'
  | 'Leisure Passenger'
  | 'Travel Operations Specialist';

export interface TokenPayload {
  passenger_id: string;
  tier_status: string;
  role: AppRole;
  preferred_language: string;
}

export interface DecodedAccessToken extends TokenPayload, JwtPayload {}
export interface DecodedRefreshToken extends Pick<TokenPayload, 'passenger_id'>, JwtPayload {}

export const TokenService = {
  signAccessToken(payload: TokenPayload): string {
    const options: SignOptions = { expiresIn: '30m' };
    return jwt.sign(
      {
        passenger_id: payload.passenger_id,
        tier_status: payload.tier_status,
        role: payload.role,
        preferred_language: payload.preferred_language,
      },
      ACCESS_TOKEN_SECRET as string,
      options,
    );
  },

  signRefreshToken(passengerId: string): string {
    const options: SignOptions = { expiresIn: '7d' };
    return jwt.sign(
      { passenger_id: passengerId },
      REFRESH_TOKEN_SECRET as string,
      options,
    );
  },

  verifyAccessToken(token: string): DecodedAccessToken {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET as string) as DecodedAccessToken;

    const validRoles: AppRole[] = [
      'Corporate Traveler',
      'Leisure Passenger',
      'Travel Operations Specialist',
    ];

    if (!validRoles.includes(decoded.role)) {
      throw new Error(`Invalid role in token: ${decoded.role}`);
    }

    return decoded;
  },

  verifyRefreshToken(token: string): DecodedRefreshToken {
    return jwt.verify(token, REFRESH_TOKEN_SECRET as string) as DecodedRefreshToken;
  },
};