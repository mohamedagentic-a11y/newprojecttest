export enum UserRole {
  CorporateTraveler = 'Corporate Traveler',
  LeisurePassenger = 'Leisure Passenger',
  TravelOperationsSpecialist = 'Travel Operations Specialist',
}

export interface PassengerProfile {
  passengerId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  documentUrl?: string;
  preferredLanguage: 'en' | 'ar';
  tierStatus: 'standard' | 'silver' | 'gold' | 'platinum';
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type CabinClass = 'economy' | 'business' | 'first';

export interface FlightSegment {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  flightNumber: string;
  aircraft: string;
  duration: number;
}

export interface FareOption {
  cabinClass: CabinClass;
  price: number;
  currency: string;
  miles: number;
  seatsAvailable: number;
  conditions: string[];
}

export interface FlightEntity {
  flightId: string;
  segments: FlightSegment[];
  fareOptions: FareOption[];
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  status: 'scheduled' | 'delayed' | 'cancelled' | 'boarding' | 'departed' | 'landed';
  operatingAirline: string;
  syncedFrom?: string;
  cachedAt?: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'rebooked'
  | 'checked_in'
  | 'completed';

export type PaymentMethod = 'miles' | 'card';

export interface SeatAssignment {
  seatNumber: string;
  cabinClass: CabinClass;
  preference: 'window' | 'aisle' | 'middle' | 'any';
}

export interface BookingEntity {
  bookingId: string;
  pnr: string;
  passengerId: string;
  flightId: string;
  flight?: FlightEntity;
  status: BookingStatus;
  seatAssignment?: SeatAssignment;
  paymentMethod: PaymentMethod;
  totalPrice?: number;
  currency?: string;
  milesUsed?: number;
  boardingPassUrl?: string;
  checkInEligible?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyTier = 'standard' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTransaction {
  transactionId: string;
  type: 'earn' | 'redeem' | 'expire' | 'adjustment';
  amount: number;
  balanceAfter: number;
  description: string;
  serviceType?: string;
  date: string;
}

export interface LoyaltyAccount {
  accountId: string;
  passengerId: string;
  balance: number;
  tierStatus: LoyaltyTier;
  tierExpiryDate: string;
  lifetimeMiles: number;
  transactions: LoyaltyTransaction[];
  updatedAt: string;
}

export type ClaimIncidentType =
  | 'delayed'
  | 'damaged'
  | 'lost'
  | 'pilfered'
  | 'other';

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'investigation'
  | 'resolved'
  | 'closed'
  | 'rejected';

export interface ClaimTimelineEntry {
  status: ClaimStatus;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface BaggageClaimEntity {
  claimId: string;
  trackingId: string;
  passengerId: string;
  pnr: string;
  incidentType: ClaimIncidentType;
  description: string;
  files: string[];
  status: ClaimStatus;
  timeline: ClaimTimelineEntry[];
  acknowledgmentEmailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccessEnvelope<T> {
  status: 'success';
  data: T;
  meta: ApiMeta;
}

export interface PaginationInfo {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface ApiErrorDetails {
  field?: string;
  constraint?: string;
  [key: string]: unknown;
}

export interface ApiErrorEnvelope {
  status: 'error';
  code: number;
  message: string;
  details?: ApiErrorDetails;
  meta: ApiMeta;
}

export interface LocalizationConfig {
  lang: 'en' | 'ar';
  dir: 'ltr' | 'rtl';
  fonts: string[];
}

export interface CheckInResponse {
  eligible: boolean;
  boardingPassUrl?: string;
}

export interface LoyaltyRedeemResponse {
  newBalance: number;
  transactionId: string;
}

export interface DataExportResponse {
  status: 'processing';
  exportJobId: string;
}