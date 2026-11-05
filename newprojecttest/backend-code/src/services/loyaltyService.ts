import { query, getClient } from '../db/pool';
import {
  getLoyaltyBalance,
  getTransactionHistory,
  postMilesDebit,
  postMilesCredit,
  reverseTransaction,
  reconcileTransactions,
  registerAuditHook,
} from '../adapters/loyaltyAdapter';

export interface LoyaltyAccountSummary {
  passengerId: string;
  tierStatus: string;
  milesBalance: number;
  pendingMiles: number;
  asOf: string;
}

export interface RedemptionResult {
  newBalance: number;
  transactionId: string;
}

const TIER_REDEMPTION_THRESHOLDS: Record<string, number> = {
  blue: 1000,
  silver: 500,
  gold: 250,
  platinum: 100,
};

function tierMinimumRedemption(tier: string): number {
  const key = tier.toLowerCase();
  return TIER_REDEMPTION_THRESHOLDS[key] ?? 1000;
}

export async function getMilesBalanceAndTier(
  passengerId: string
): Promise<LoyaltyAccountSummary> {
  const result = await query(
    `SELECT passenger_id, tier_status, miles_balance, pending_miles, updated_at
     FROM loyalty_accounts
     WHERE passenger_id = $1`,
    [passengerId]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Loyalty account not found'), { status: 404 });
  }

  const row = result.rows[0];

  const adapterBalance = await getLoyaltyBalance(passengerId);

  return {
    passengerId: row.passenger_id,
    tierStatus: row.tier_status,
    milesBalance: row.miles_balance,
    pendingMiles: row.pending_miles,
    asOf: adapterBalance.asOf ?? row.updated_at,
  };
}

export async function redeemMiles(
  passengerId: string,
  amount: number,
  serviceType: string
): Promise<RedemptionResult> {
  if (!passengerId || typeof amount !== 'number' || amount <= 0) {
    throw Object.assign(new Error('Invalid redemption parameters'), { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT passenger_id, tier_status, miles_balance, pending_miles
       FROM loyalty_accounts
       WHERE passenger_id = $1
       FOR UPDATE`,
      [passengerId]
    );

    if (lockResult.rows.length === 0) {
      throw Object.assign(new Error('Loyalty account not found'), { status: 404 });
    }

    const account = lockResult.rows[0];
    const tier: string = account.tier_status;
    const currentBalance: number = Number(account.miles_balance);

    const minimumRedemption = tierMinimumRedemption(tier);
    if (amount < minimumRedemption) {
      throw Object.assign(
        new Error(
          `Minimum redemption for tier '${tier}' is ${minimumRedemption} miles`
        ),
        { status: 422 }
      );
    }

    if (currentBalance < amount) {
      throw Object.assign(
        new Error(
          `Insufficient miles balance: available ${currentBalance}, requested ${amount}`
        ),
        { status: 422 }
      );
    }

    const newBalance = currentBalance - amount;

    await client.query(
      `UPDATE loyalty_accounts
       SET miles_balance = $1, updated_at = NOW()
       WHERE passenger_id = $2`,
      [newBalance, passengerId]
    );

    const debitResult = await postMilesDebit(passengerId, amount, serviceType);

    const transactionId: string =
      (debitResult as unknown as { transactionId?: string }).transactionId ??
      `txn_${Date.now()}`;

    await client.query('COMMIT');

    await reconcileTransactions(passengerId).catch(() => {
      // reconciliation failure does not roll back the committed debit
    });

    return { newBalance, transactionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTransactionLedger(passengerId: string) {
  const history = await getTransactionHistory(passengerId);
  return history;
}

export async function creditMiles(
  passengerId: string,
  amount: number,
  serviceType: string
) {
  if (!passengerId || typeof amount !== 'number' || amount <= 0) {
    throw Object.assign(new Error('Invalid credit parameters'), { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT miles_balance FROM loyalty_accounts WHERE passenger_id = $1 FOR UPDATE`,
      [passengerId]
    );

    if (lockResult.rows.length === 0) {
      throw Object.assign(new Error('Loyalty account not found'), { status: 404 });
    }

    const currentBalance = Number(lockResult.rows[0].miles_balance);
    const newBalance = currentBalance + amount;

    await client.query(
      `UPDATE loyalty_accounts SET miles_balance = $1, updated_at = NOW() WHERE passenger_id = $2`,
      [newBalance, passengerId]
    );

    const creditResult = await postMilesCredit(passengerId, amount, serviceType);

    await client.query('COMMIT');

    await reconcileTransactions(passengerId).catch(() => {});

    return { newBalance, creditResult };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reverseMilesTransaction(
  passengerId: string,
  transactionId: string
) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT miles_balance FROM loyalty_accounts WHERE passenger_id = $1 FOR UPDATE`,
      [passengerId]
    );

    if (lockResult.rows.length === 0) {
      throw Object.assign(new Error('Loyalty account not found'), { status: 404 });
    }

    const reversalResult = await reverseTransaction(passengerId, transactionId);

    await client.query('COMMIT');

    await reconcileTransactions(passengerId).catch(() => {});

    return reversalResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reconcileLoyaltyLedger(passengerId: string) {
  return reconcileTransactions(passengerId);
}

export { registerAuditHook };