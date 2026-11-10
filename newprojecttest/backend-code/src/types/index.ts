export enum PassengerRole {
  CORPORATE_TRAVELER = 'Corporate Traveler',
  LEISURE_PASSENGER = 'Leisure Passenger',
  TRAVEL_OPERATIONS_SPECIALIST = 'Travel Operations Specialist',
}

export interface Passenger {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  documentUrl?: string;
  role: PassengerRole;
  tierStatus: 'standard' | 'silver' | 'gold' | 'platinum';
  preferredLanguage: 'en' | 'ar';
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CabinClass = 'economy' | 'business' | 'first';
export type FlightStatus = 'scheduled' | 'boarding' | 'departed' | 'arrived' | 'cancelled' | 'delayed';

export interface Flight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: Date;
  arrivalTime: Date;
  cabinClass: CabinClass;
  availableSeats: number;
  baseFareCents: number;
  milesRequired: number;
  status: FlightStatus;
  aircraftType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'boarded' | 'completed';
export type PaymentMethod = 'miles' | 'card';
export type SeatPreference = 'window' | 'aisle' | 'middle' | 'any';

export interface Booking {
  id: string;
  passengerId: string;
  flightId: string;
  pnr: string;
  status: BookingStatus;
  seatPreference: SeatPreference;
  seatNumber?: string;
  paymentMethod: PaymentMethod;
  fareAmountCents: number;
  milesUsed: number;
  boardingPassUrl?: string;
  checkInEligibleAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ClaimIncidentType = 'delayed' | 'damaged' | 'lost' | 'pilfered' | 'other';
export type ClaimStatus =
  | 'submitted'
  | 'acknowledged'
  | 'under_review'
  | 'resolved'
  | 'rejected'
  | 'closed';

export interface BaggageClaimTimeline {
  status: ClaimStatus;
  note?: string;
  timestamp: Date;
}

export interface BaggageClaim {
  id: string;
  passengerId: string;
  pnr: string;
  trackingId: string;
  incidentType: ClaimIncidentType;
  description: string;
  files: string[];
  status: ClaimStatus;
  timeline: BaggageClaimTimeline[];
  operationalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TierStatus = 'standard' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTransaction {
  id: string;
  loyaltyAccountId: string;
  passengerId: string;
  type: 'earn' | 'redeem' | 'adjustment' | 'expiry';
  amount: number;
  balanceAfter: number;
  serviceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: Date;
}

export interface LoyaltyAccount {
  id: string;
  passengerId: string;
  milesBalance: number;
  tierStatus: TierStatus;
  tierExpiresAt?: Date;
  lifetimeMilesEarned: number;
  transactions: LoyaltyTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'account_locked'
  | 'password_changed'
  | 'profile_updated'
  | 'booking_created'
  | 'booking_modified'
  | 'booking_cancelled'
  | 'miles_redeemed'
  | 'baggage_claim_submitted'
  | 'data_export_requested'
  | 'admin_action';

export interface AuditLog {
  id: string;
  passengerId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  code?: number;
  message?: string;
  details?: Record<string, unknown>;
  meta: ResponseMeta;
}

export interface PaginationInfo {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface PaginatedResponse<T = unknown> {
  status: 'success';
  data: T[];
  pagination: PaginationInfo;
  meta: ResponseMeta;
}

export interface JwtPayload {
  passenger_id: string;
  email: string;
  role: PassengerRole;
  tier_status: TierStatus;
  preferred_language: 'en' | 'ar';
  iat?: number;
  exp?: number;
}