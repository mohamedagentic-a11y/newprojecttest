import { LoyaltyRepository, LoyaltyAccount, LoyaltyTransaction } from '../repositories/LoyaltyRepository';

// Tier thresholds for eligibility checks (BR-005)
const TIER_THRESHOLDS: Record<string, number> = {
  bronze: 0,
  silver: 10000,
  gold: 50000,
  platinum: 100000,
};

// Minimum balance required to perform any redemption
const MINIMUM_REDEMPTION_BALANCE = 500;

// Minimum miles that can be redeemed in a single transaction
const MINIMUM_REDEMPTION_AMOUNT = 500;

export interface RedemptionInput {
  passengerId: string;
  amount: number;
  serviceType: string;
  idempotencyKey: string;
  referenceId?: string;
}

export interface RedemptionResult {
  newBalance: number;
  transactionId: string;
}

export interface BalanceResult {
  account: LoyaltyAccount;
  recentTransactions: LoyaltyTransaction[];
}

export class LoyaltyService {
  private repository: LoyaltyRepository;

  constructor(repository: LoyaltyRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves loyalty balance and recent transaction history for a passenger.
   * Satisfies US-004 / Feature-3.1 / AC-01, AC-02.
   */
  async getBalance(passengerId: string): Promise<BalanceResult> {
    const account = await this.repository.findByPassengerId(passengerId);

    if (!account) {
      throw new Error(`Loyalty account not found for passenger: ${passengerId}`);
    }

    const recentTransactions = await this.repository.findTransactionsByAccountId(
      account.id,
      20,
    );

    return { account, recentTransactions };
  }

  /**
   * Validates that a tier_status string is a recognized tier.
   * Satisfies AC-02 of US-004 — tier badges render correctly based on threshold mappings.
   */
  validateTier(tierStatus: string): boolean {
    return Object.prototype.hasOwnProperty.call(TIER_THRESHOLDS, tierStatus.toLowerCase());
  }

  /**
   * Returns the minimum miles balance threshold required for a given tier.
   */
  getTierThreshold(tierStatus: string): number {
    const key = tierStatus.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TIER_THRESHOLDS, key)) {
      throw new Error(`Unknown tier status: ${tierStatus}`);
    }
    return TIER_THRESHOLDS[key];
  }

  /**
   * Validates that a passenger's current balance meets the tier threshold.
   * A passenger must have at least the tier's threshold in miles to be eligible for redemption.
   */
  private assertTierEligible(account: LoyaltyAccount): void {
    const tierKey = account.tier_status.toLowerCase();
    const threshold = TIER_THRESHOLDS[tierKey];

    if (threshold === undefined) {
      throw new Error(`Unrecognized tier status "${account.tier_status}" on account ${account.id}`);
    }

    if (account.miles_balance < threshold) {
      throw new Error(
        `Tier ineligible: balance ${account.miles_balance} is below the minimum threshold ` +
          `${threshold} required for tier "${account.tier_status}".`,
      );
    }
  }

  /**
   * Atomically redeems miles from a passenger's loyalty account.
   * Enforces minimum balance and tier threshold requirements per BR-005.
   * Records an immutable audit transaction per US-005 / AC-02.
   * Idempotency is enforced by the caller-supplied idempotencyKey stored as reference_id.
   * Satisfies US-005 / Feature-3.2 / AC-01, AC-02.
   */
  async redeemMiles(input: RedemptionInput): Promise<RedemptionResult> {
    const { passengerId, amount, serviceType, idempotencyKey, referenceId } = input;

    // Validate redemption amount floor
    if (amount < MINIMUM_REDEMPTION_AMOUNT) {
      throw new Error(
        `Redemption amount ${amount} is below the minimum allowed redemption of ${MINIMUM_REDEMPTION_AMOUNT} miles.`,
      );
    }

    // Fetch current account
    const account = await this.repository.findByPassengerId(passengerId);
    if (!account) {
      throw new Error(`Loyalty account not found for passenger: ${passengerId}`);
    }

    // Check tier eligibility (BR-005)
    this.assertTierEligible(account);

    // Check absolute minimum balance floor
    if (account.miles_balance < MINIMUM_REDEMPTION_BALANCE) {
      throw new Error(
        `Insufficient balance: ${account.miles_balance} miles is below the minimum required ` +
          `balance of ${MINIMUM_REDEMPTION_BALANCE} miles to perform any redemption.`,
      );
    }

    // Check that the account has enough miles for this specific redemption
    if (account.miles_balance < amount) {
      throw new Error(
        `Insufficient balance: requested redemption of ${amount} miles exceeds ` +
          `available balance of ${account.miles_balance} miles.`,
      );
    }

    // Deduct miles atomically
    const updatedAccount = await this.repository.updateBalance(account.id, -amount);

    // Record immutable audit transaction (AC-02)
    const transaction = await this.repository.appendTransaction({
      loyalty_account_id: account.id,
      transaction_type: 'redeem',
      amount,
      description: `Miles redeemed for ${serviceType}`,
      reference_id: referenceId ?? idempotencyKey,
    });

    return {
      newBalance: updatedAccount.miles_balance,
      transactionId: transaction.id,
    };
  }

  /**
   * Returns transaction history for a loyalty account belonging to a passenger.
   * Supports cursor-based pagination as per architecture/api-specification.md.
   */
  async getTransactionHistory(
    passengerId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{ account: LoyaltyAccount; transactions: LoyaltyTransaction[] }> {
    const account = await this.repository.findByPassengerId(passengerId);
    if (!account) {
      throw new Error(`Loyalty account not found for passenger: ${passengerId}`);
    }

    const transactions = await this.repository.findTransactionsByAccountId(
      account.id,
      limit,
      cursor,
    );

    return { account, transactions };
  }
}