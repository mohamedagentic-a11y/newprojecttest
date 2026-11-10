export enum UserRole {
  CorporateTraveler = 'CorporateTraveler',
  LeisurePassenger = 'LeisurePassenger',
  TravelOperationsSpecialist = 'TravelOperationsSpecialist',
}

export interface JWTPayload {
  passenger_id: string;
  tier_status: string;
  preferred_language: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface PassengerProfileEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  documentUrl: string | null;
  preferredLanguage: string;
  tierStatus: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type CabinClass = 'economy' | 'business' | 'first';

export interface FlightEntity {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: CabinClass;
  availableSeats: number;
  fareAmount: number;
  fareCurrency: string;
  milesRequired: number | null;
  airline: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'rebooked'
  | 'checked_in';

export type PaymentMethod = 'miles' | 'card';

export interface BookingEntity {
  id: string;
  passengerId: string;
  flightId: string;
  flight?: FlightEntity;
  pnr: string;
  seatPreference: string;
  seatNumber: string | null;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  fareAmount: number;
  fareCurrency: string;
  milesUsed: number;
  boardingPassUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatedBookingEntity extends BookingEntity {
  previousFlightId: string;
  fareDifference: number;
  rebookTransactionId: string | null;
}

export type TierStatus = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTransactionSummary {
  earned: number;
  redeemed: number;
  expired: number;
  period: string;
}

export interface LoyaltyAccountEntity {
  id: string;
  passengerId: string;
  milesBalance: number;
  tierStatus: TierStatus;
  tierExpiryDate: string;
  transactionHistory: LoyaltyTransactionSummary;
  createdAt: string;
  updatedAt: string;
}

export type IncidentType = 'delayed' | 'damaged' | 'lost' | 'pilfered';

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'resolved'
  | 'rejected'
  | 'pending_info';

export interface ClaimTimelineEvent {
  status: ClaimStatus;
  timestamp: string;
  note: string | null;
  updatedBy: string | null;
}

export interface BaggageClaimEntity {
  id: string;
  trackingId: string;
  passengerId: string;
  pnr: string;
  incidentType: IncidentType;
  description: string;
  files: string[];
  status: ClaimStatus;
  timeline: ClaimTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccessEnvelope<T = unknown> {
  status: 'success';
  data: T;
  meta: ApiMeta;
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