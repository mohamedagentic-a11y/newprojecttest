import { pool } from '../db/pool';
import { PoolClient, QueryResult } from 'pg';

export interface LoyaltyAccount {
  id: string;
  passenger_id: string;
  miles_balance: number;
  tier_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface LoyaltyTransaction {
  id: string;
  loyalty_account_id: string;
  transaction_type: 'earn' | 'redeem' | 'adjustment' | 'expire';
  amount: number;
  description: string;
  reference_id?: string;
  created_at: Date;
}

export interface AppendTransactionInput {
  loyalty_account_id: string;
  transaction_type: 'earn' | 'redeem' | 'adjustment' | 'expire';
  amount: number;
  description: string;
  reference_id?: string;
}

export class LoyaltyRepository {
  async findByPassengerId(passengerId: string): Promise<LoyaltyAccount | null> {
    const result: QueryResult<LoyaltyAccount> = await pool.query(
      `SELECT
        id,
        passenger_id,
        miles_balance,
        tier_status,
        created_at,
        updated_at
       FROM loyalty_accounts
       WHERE passenger_id = $1
       LIMIT 1`,
      [passengerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async updateBalance(
    loyaltyAccountId: string,
    delta: number
  ): Promise<LoyaltyAccount> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the row for update to prevent concurrent modifications
      const lockResult: QueryResult<LoyaltyAccount> = await client.query(
        `SELECT
          id,
          passenger_id,
          miles_balance,
          tier_status,
          created_at,
          updated_at
         FROM loyalty_accounts
         WHERE id = $1
         FOR UPDATE`,
        [loyaltyAccountId]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(
          `Loyalty account not found for id: ${loyaltyAccountId}`
        );
      }

      const current = lockResult.rows[0];
      const newBalance = current.miles_balance + delta;

      if (newBalance < 0) {
        await client.query('ROLLBACK');
        throw new Error(
          `Insufficient miles balance. Current: ${current.miles_balance}, requested delta: ${delta}`
        );
      }

      const updateResult: QueryResult<LoyaltyAccount> = await client.query(
        `UPDATE loyalty_accounts
         SET
           miles_balance = $1,
           updated_at = NOW()
         WHERE id = $2
         RETURNING
           id,
           passenger_id,
           miles_balance,
           tier_status,
           created_at,
           updated_at`,
        [newBalance, loyaltyAccountId]
      );

      await client.query('COMMIT');

      return updateResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async appendTransaction(
    input: AppendTransactionInput
  ): Promise<LoyaltyTransaction> {
    const { loyalty_account_id, transaction_type, amount, description, reference_id } =
      input;

    const result: QueryResult<LoyaltyTransaction> = await pool.query(
      `INSERT INTO loyalty_transactions
         (loyalty_account_id, transaction_type, amount, description, reference_id, created_at)
       VALUES
         ($1, $2, $3, $4, $5, NOW())
       RETURNING
         id,
         loyalty_account_id,
         transaction_type,
         amount,
         description,
         reference_id,
         created_at`,
      [loyalty_account_id, transaction_type, amount, description, reference_id ?? null]
    );

    return result.rows[0];
  }

  async findTransactionsByAccountId(
    loyaltyAccountId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<{ transactions: LoyaltyTransaction[]; hasMore: boolean; nextCursor: string | null }> {
    let queryText: string;
    let queryParams: (string | number)[];

    if (cursor) {
      queryText = `
        SELECT
          id,
          loyalty_account_id,
          transaction_type,
          amount,
          description,
          reference_id,
          created_at
        FROM loyalty_transactions
        WHERE loyalty_account_id = $1
          AND id < $2
        ORDER BY created_at DESC, id DESC
        LIMIT $3
      `;
      queryParams = [loyaltyAccountId, cursor, limit + 1];
    } else {
      queryText = `
        SELECT
          id,
          loyalty_account_id,
          transaction_type,
          amount,
          description,
          reference_id,
          created_at
        FROM loyalty_transactions
        WHERE loyalty_account_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      `;
      queryParams = [loyaltyAccountId, limit + 1];
    }

    const result: QueryResult<LoyaltyTransaction> = await pool.query(
      queryText,
      queryParams
    );

    const hasMore = result.rows.length > limit;
    const transactions = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor =
      hasMore && transactions.length > 0
        ? transactions[transactions.length - 1].id
        : null;

    return { transactions, hasMore, nextCursor };
  }
}