import axios, { AxiosInstance, AxiosResponse } from 'axios';

if (!process.env.PAYMENT_GATEWAY_BASE_URL) {
  throw new Error('PAYMENT_GATEWAY_BASE_URL environment variable is required');
}

if (!process.env.PAYMENT_GATEWAY_API_KEY) {
  throw new Error('PAYMENT_GATEWAY_API_KEY environment variable is required');
}

const PAYMENT_GATEWAY_BASE_URL = process.env.PAYMENT_GATEWAY_BASE_URL;
const PAYMENT_GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_API_KEY;
const PAYMENT_GATEWAY_TIMEOUT_MS = parseInt(process.env.PAYMENT_GATEWAY_TIMEOUT_MS ?? '10000', 10);

export interface CardPaymentRequest {
  idempotencyKey: string;
  passengerId: string;
  amount: number;
  currency: string;
  cardToken: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface CardPaymentResponse {
  transactionId: string;
  status: 'approved' | 'declined' | 'pending';
  amount: number;
  currency: string;
  authorizationCode: string;
  processedAt: string;
}

export interface MilesDeductionRequest {
  idempotencyKey: string;
  passengerId: string;
  loyaltyAccountId: string;
  milesAmount: number;
  serviceType: 'upgrade' | 'discount' | 'ticket';
  bookingReference?: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface MilesDeductionResponse {
  transactionId: string;
  status: 'success' | 'failed' | 'insufficient_balance' | 'tier_ineligible';
  deductedMiles: number;
  newBalance: number;
  processedAt: string;
}

export interface MilesBalanceResponse {
  loyaltyAccountId: string;
  passengerId: string;
  currentBalance: number;
  tierStatus: string;
  lastUpdated: string;
}

export interface RefundRequest {
  idempotencyKey: string;
  originalTransactionId: string;
  passengerId: string;
  amount: number;
  currency: string;
  reason: string;
}

export interface RefundResponse {
  refundId: string;
  originalTransactionId: string;
  status: 'processed' | 'pending' | 'failed';
  amount: number;
  currency: string;
  processedAt: string;
}

export interface MilesReversalRequest {
  idempotencyKey: string;
  originalTransactionId: string;
  passengerId: string;
  loyaltyAccountId: string;
  milesAmount: number;
  reason: string;
}

export interface MilesReversalResponse {
  reversalId: string;
  originalTransactionId: string;
  status: 'success' | 'failed';
  restoredMiles: number;
  newBalance: number;
  processedAt: string;
}

export class PaymentGatewayAdapter {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: PAYMENT_GATEWAY_BASE_URL,
      timeout: PAYMENT_GATEWAY_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': PAYMENT_GATEWAY_API_KEY,
      },
    });

    this.client.interceptors.request.use((config) => {
      config.headers['X-Request-Timestamp'] = new Date().toISOString();
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status: number | undefined = error.response?.status;
        const message: string = error.response?.data?.message ?? error.message ?? 'Payment gateway error';
        const code: string = error.response?.data?.code ?? 'GATEWAY_ERROR';

        const enriched = new Error(
          `PaymentGatewayAdapter error [${status ?? 'NETWORK'}/${code}]: ${message}`
        );
        (enriched as NodeJS.ErrnoException).code = code;
        return Promise.reject(enriched);
      }
    );
  }

  /**
   * Process a card payment for a booking or service.
   * Uses idempotency key to prevent duplicate charges on retry.
   */
  async processCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse> {
    const response: AxiosResponse<CardPaymentResponse> = await this.client.post(
      '/payments/card',
      {
        passengerId: request.passengerId,
        amount: request.amount,
        currency: request.currency,
        cardToken: request.cardToken,
        description: request.description,
        metadata: request.metadata ?? {},
      },
      {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        },
      }
    );

    return response.data;
  }

  /**
   * Deduct miles from a loyalty account for redemption (upgrade, discount, ticket).
   * Uses idempotency key to prevent duplicate deductions during retries (US-005, AC-01).
   * Returns tier_ineligible or insufficient_balance status without throwing for
   * business-rule failures, so callers can distinguish gateway errors from eligibility errors.
   */
  async deductMiles(request: MilesDeductionRequest): Promise<MilesDeductionResponse> {
    const response: AxiosResponse<MilesDeductionResponse> = await this.client.post(
      '/loyalty/deduct',
      {
        passengerId: request.passengerId,
        loyaltyAccountId: request.loyaltyAccountId,
        milesAmount: request.milesAmount,
        serviceType: request.serviceType,
        bookingReference: request.bookingReference ?? null,
        description: request.description,
        metadata: request.metadata ?? {},
      },
      {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        },
      }
    );

    return response.data;
  }

  /**
   * Query the current miles balance and tier status for a loyalty account.
   */
  async getMilesBalance(loyaltyAccountId: string, passengerId: string): Promise<MilesBalanceResponse> {
    const response: AxiosResponse<MilesBalanceResponse> = await this.client.get(
      `/loyalty/accounts/${encodeURIComponent(loyaltyAccountId)}/balance`,
      {
        params: { passengerId },
      }
    );

    return response.data;
  }

  /**
   * Refund a card payment. Uses idempotency key to prevent duplicate refunds.
   */
  async refundCardPayment(request: RefundRequest): Promise<RefundResponse> {
    const response: AxiosResponse<RefundResponse> = await this.client.post(
      `/payments/${encodeURIComponent(request.originalTransactionId)}/refund`,
      {
        passengerId: request.passengerId,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
      },
      {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        },
      }
    );

    return response.data;
  }

  /**
   * Reverse a miles deduction (restore miles) if downstream processing fails.
   * Uses idempotency key to prevent duplicate reversals during retries.
   */
  async reverseMilesDeduction(request: MilesReversalRequest): Promise<MilesReversalResponse> {
    const response: AxiosResponse<MilesReversalResponse> = await this.client.post(
      `/loyalty/transactions/${encodeURIComponent(request.originalTransactionId)}/reverse`,
      {
        passengerId: request.passengerId,
        loyaltyAccountId: request.loyaltyAccountId,
        milesAmount: request.milesAmount,
        reason: request.reason,
      },
      {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        },
      }
    );

    return response.data;
  }
}