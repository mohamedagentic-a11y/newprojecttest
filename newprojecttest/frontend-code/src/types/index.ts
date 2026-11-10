export enum PassengerRole {
  CorporateTraveler = 'Corporate Traveler',
  LeisurePassenger = 'Leisure Passenger',
  TravelOperationsSpecialist = 'Travel Operations Specialist',
}

export interface Passenger {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  documentUrl?: string;
  preferredLanguage: 'en' | 'ar';
  role: PassengerRole;
  tierStatus: 'standard' | 'silver' | 'gold' | 'platinum';
  createdAt: string;
  updatedAt: string;
}

export type CabinClass = 'economy' | 'business' | 'first';

export type FlightStatus =
  | 'scheduled'
  | 'boarding'
  | 'departed'
  | 'arrived'
  | 'cancelled'
  | 'delayed';

export interface SeatAssignment {
  seatNumber: string;
  cabinClass: CabinClass;
  seatType: 'window' | 'middle' | 'aisle';
}

export interface Flight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: CabinClass;
  status: FlightStatus;
  availableSeats: number;
  fareAmount: number;
  currency: string;
  milesRequired?: number;
  aircraft?: string;
  carrier?: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'rebooked';

export type PaymentMethod = 'miles' | 'card';

export interface Booking {
  id: string;
  passengerId: string;
  flightId: string;
  flight?: Flight;
  pnr: string;
  status: BookingStatus;
  seatAssignment?: SeatAssignment;
  seatPreference?: 'window' | 'middle' | 'aisle';
  paymentMethod: PaymentMethod;
  fareAmount?: number;
  milesUsed?: number;
  currency?: string;
  checkinEligible?: boolean;
  boardingPassUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type BaggageIncidentType = 'delayed' | 'damaged' | 'lost' | 'pilfered';

export type BaggageClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'resolved'
  | 'closed'
  | 'rejected';

export interface BaggageClaimTimeline {
  status: BaggageClaimStatus;
  timestamp: string;
  note?: string;
}

export interface BaggageClaim {
  id: string;
  passengerId: string;
  pnr: string;
  incidentType: BaggageIncidentType;
  description: string;
  files?: string[];
  status: BaggageClaimStatus;
  trackingId: string;
  timeline?: BaggageClaimTimeline[];
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyTier = 'standard' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTransaction {
  id: string;
  type: 'earn' | 'redeem' | 'expire' | 'adjustment';
  amount: number;
  balanceAfter: number;
  description: string;
  serviceType?: string;
  transactionId?: string;
  createdAt: string;
}

export interface LoyaltyAccount {
  passengerId: string;
  balance: number;
  tierStatus: LoyaltyTier;
  tierExpiryDate?: string;
  lifetimeMiles?: number;
  transactions?: LoyaltyTransaction[];
}

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  code?: number;
  message?: string;
  details?: Record<string, unknown>;
  meta: ApiResponseMeta;
}

export interface PaginationInfo {
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
}

export interface PaginatedResponse<T> {
  status: 'success' | 'error';
  data: T[];
  pagination: PaginationInfo;
  meta: ApiResponseMeta;
}