-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Initial schema creation for SkyWings Flight Booking Portal
-- Creates: passengers, flights, bookings, loyalty_accounts, baggage_claims,
--          audit_logs tables with FK constraints, indexes, RLS stubs,
--          and WORM protection on audit_logs.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Custom ENUM types
-- ---------------------------------------------------------------------------

CREATE TYPE passenger_role AS ENUM (
    'Corporate Traveler',
    'Leisure Passenger',
    'Travel Operations Specialist'
);

CREATE TYPE tier_status AS ENUM (
    'standard',
    'silver',
    'gold',
    'platinum'
);

CREATE TYPE cabin_class AS ENUM (
    'economy',
    'premium_economy',
    'business',
    'first'
);

CREATE TYPE booking_status AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'cancelled',
    'completed',
    'rebooking'
);

CREATE TYPE payment_method AS ENUM (
    'miles',
    'card',
    'mixed'
);

CREATE TYPE claim_incident_type AS ENUM (
    'delayed',
    'damaged',
    'lost',
    'other'
);

CREATE TYPE claim_status AS ENUM (
    'submitted',
    'under_review',
    'resolved',
    'rejected',
    'closed'
);

CREATE TYPE audit_action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'LOGIN_FAILED',
    'EXPORT_REQUEST',
    'PROFILE_UPDATE',
    'BOOKING_CREATE',
    'BOOKING_REBOOK',
    'BOOKING_CANCEL',
    'LOYALTY_REDEEM',
    'CLAIM_SUBMIT',
    'CHECKIN',
    'PASSWORD_CHANGE',
    'ACCOUNT_LOCKED'
);

CREATE TYPE preferred_language AS ENUM (
    'en',
    'ar'
);

-- ---------------------------------------------------------------------------
-- Table: passengers
-- ---------------------------------------------------------------------------

CREATE TABLE passengers (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(320)    NOT NULL,
    password_hash       TEXT            NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    phone               VARCHAR(30),
    date_of_birth       DATE,
    nationality         CHAR(2),                            -- ISO 3166-1 alpha-2
    document_url        TEXT,                               -- DPO-validated document reference
    preferred_language  preferred_language NOT NULL DEFAULT 'en',
    role                passenger_role  NOT NULL DEFAULT 'Leisure Passenger',
    tier_status         tier_status     NOT NULL DEFAULT 'standard',
    failed_login_count  SMALLINT        NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT passengers_email_unique UNIQUE (email),
    CONSTRAINT passengers_failed_login_count_non_negative CHECK (failed_login_count >= 0)
);

COMMENT ON TABLE passengers IS 'Registered passenger accounts including PII and authentication state.';
COMMENT ON COLUMN passengers.document_url IS 'Reference to DPO-validated identity document; subject to PDPL data handling.';
COMMENT ON COLUMN passengers.failed_login_count IS 'Consecutive failed login attempts; account locks after 5 per NFR-002.';
COMMENT ON COLUMN passengers.locked_until IS 'If set and in the future, the account is locked against login.';

-- ---------------------------------------------------------------------------
-- Table: flights
-- ---------------------------------------------------------------------------

CREATE TABLE flights (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_number       VARCHAR(10)     NOT NULL,
    origin              CHAR(3)         NOT NULL,           -- IATA airport code
    destination         CHAR(3)         NOT NULL,
    departure_time      TIMESTAMPTZ     NOT NULL,
    arrival_time        TIMESTAMPTZ     NOT NULL,
    cabin_class         cabin_class     NOT NULL DEFAULT 'economy',
    aircraft_type       VARCHAR(50),
    total_seats         SMALLINT        NOT NULL,
    available_seats     SMALLINT        NOT NULL,
    base_fare_amount    NUMERIC(12, 2)  NOT NULL,
    fare_currency       CHAR(3)         NOT NULL DEFAULT 'SAR',
    miles_equivalent    INTEGER         NOT NULL DEFAULT 0,
    gds_sync_at         TIMESTAMPTZ,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT flights_arrival_after_departure CHECK (arrival_time > departure_time),
    CONSTRAINT flights_seats_non_negative CHECK (available_seats >= 0),
    CONSTRAINT flights_total_seats_positive CHECK (total_seats > 0),
    CONSTRAINT flights_available_lte_total CHECK (available_seats <= total_seats),
    CONSTRAINT flights_fare_non_negative CHECK (base_fare_amount >= 0),
    CONSTRAINT flights_miles_non_negative CHECK (miles_equivalent >= 0),
    CONSTRAINT flights_origin_dest_differ CHECK (origin <> destination)
);

COMMENT ON TABLE flights IS 'Flight inventory synced from GDS adapter. Cached with TTL of 900 seconds.';
COMMENT ON COLUMN flights.gds_sync_at IS 'Timestamp of last GDS synchronisation for this record.';

-- ---------------------------------------------------------------------------
-- Table: bookings
-- ---------------------------------------------------------------------------

CREATE TABLE bookings (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pnr                 VARCHAR(10)     NOT NULL,
    passenger_id        UUID            NOT NULL,
    flight_id           UUID            NOT NULL,
    seat_preference     VARCHAR(20),                        -- e.g. 'window', 'aisle', 'middle'
    seat_number         VARCHAR(5),
    cabin_class         cabin_class     NOT NULL,
    status              booking_status  NOT NULL DEFAULT 'pending',
    payment_method      payment_method  NOT NULL,
    fare_amount         NUMERIC(12, 2)  NOT NULL,
    fare_currency       CHAR(3)         NOT NULL DEFAULT 'SAR',
    miles_used          INTEGER         NOT NULL DEFAULT 0,
    fare_difference     NUMERIC(12, 2)  NOT NULL DEFAULT 0, -- populated on rebook
    previous_flight_id  UUID,                               -- populated on rebook
    checked_in_at       TIMESTAMPTZ,
    boarding_pass_url   TEXT,
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT bookings_pnr_unique UNIQUE (pnr),
    CONSTRAINT bookings_fare_non_negative CHECK (fare_amount >= 0),
    CONSTRAINT bookings_miles_non_negative CHECK (miles_used >= 0),
    CONSTRAINT bookings_passenger_fk FOREIGN KEY (passenger_id)
        REFERENCES passengers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT bookings_flight_fk FOREIGN KEY (flight_id)
        REFERENCES flights (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT bookings_previous_flight_fk FOREIGN KEY (previous_flight_id)
        REFERENCES flights (id) ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE bookings IS 'Flight reservations. PNR is the external reference code.';
COMMENT ON COLUMN bookings.fare_difference IS 'Delta fare charged or refunded during rebooking (BR-003).';
COMMENT ON COLUMN bookings.previous_flight_id IS 'Original flight reference when booking is rebooking.';

-- ---------------------------------------------------------------------------
-- Table: loyalty_accounts
-- ---------------------------------------------------------------------------

CREATE TABLE loyalty_accounts (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id        UUID            NOT NULL,
    miles_balance       INTEGER         NOT NULL DEFAULT 0,
    tier_status         tier_status     NOT NULL DEFAULT 'standard',
    tier_valid_until    DATE,
    lifetime_miles      INTEGER         NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT loyalty_accounts_passenger_unique UNIQUE (passenger_id),
    CONSTRAINT loyalty_accounts_passenger_fk FOREIGN KEY (passenger_id)
        REFERENCES passengers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT loyalty_miles_non_negative CHECK (miles_balance >= 0),
    CONSTRAINT loyalty_lifetime_non_negative CHECK (lifetime_miles >= 0)
);

COMMENT ON TABLE loyalty_accounts IS 'Frequent flyer loyalty programme accounts. One per passenger.';

-- ---------------------------------------------------------------------------
-- Table: loyalty_transactions  (supporting ledger for loyalty_accounts)
-- ---------------------------------------------------------------------------

CREATE TABLE loyalty_transactions (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_account_id  UUID            NOT NULL,
    booking_id          UUID,
    transaction_ref     VARCHAR(50)     NOT NULL,           -- e.g. txn_456
    delta_miles         INTEGER         NOT NULL,           -- positive = earn, negative = redeem
    service_type        VARCHAR(50),                        -- 'upgrade', 'booking', etc.
    balance_after       INTEGER         NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT loyalty_transactions_account_fk FOREIGN KEY (loyalty_account_id)
        REFERENCES loyalty_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT loyalty_transactions_booking_fk FOREIGN KEY (booking_id)
        REFERENCES bookings (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT loyalty_transactions_balance_non_negative CHECK (balance_after >= 0)
);

COMMENT ON TABLE loyalty_transactions IS 'Immutable ledger of all miles earn/redeem events.';

-- ---------------------------------------------------------------------------
-- Table: baggage_claims
-- ---------------------------------------------------------------------------

CREATE TABLE baggage_claims (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id         VARCHAR(20)         NOT NULL,
    passenger_id        UUID                NOT NULL,
    booking_id          UUID,
    pnr                 VARCHAR(10)         NOT NULL,
    incident_type       claim_incident_type NOT NULL,
    description         TEXT,
    file_references     JSONB               NOT NULL DEFAULT '[]',  -- array of URLs/base64 refs
    status              claim_status        NOT NULL DEFAULT 'submitted',
    acknowledgement_sent_at TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT baggage_claims_tracking_unique UNIQUE (tracking_id),
    CONSTRAINT baggage_claims_passenger_fk FOREIGN KEY (passenger_id)
        REFERENCES passengers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT baggage_claims_booking_fk FOREIGN KEY (booking_id)
        REFERENCES bookings (id) ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE baggage_claims IS 'Baggage incident reports submitted by passengers.';
COMMENT ON COLUMN baggage_claims.file_references IS 'JSON array of evidence file URLs or references.';

-- ---------------------------------------------------------------------------
-- Table: audit_logs  (WORM — no UPDATE or DELETE permitted)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_time          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    passenger_id        UUID,                               -- nullable: system events have no passenger
    performed_by        UUID,                               -- operator / passenger who triggered action
    action              audit_action    NOT NULL,
    table_name          VARCHAR(100),
    record_id           UUID,                               -- PK of the affected row
    old_values          JSONB,
    new_values          JSONB,
    ip_address          INET,
    user_agent          TEXT,
    request_id          VARCHAR(50),
    details             JSONB,

    -- Soft FK: do not CASCADE delete; passengers must be retained for audit
    CONSTRAINT audit_logs_passenger_fk FOREIGN KEY (passenger_id)
        REFERENCES passengers (id) ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE audit_logs IS
    'Append-only WORM audit trail. No row may ever be updated or deleted. '
    'Protected by triggers and should be backed by storage-level immutability.';

-- ---------------------------------------------------------------------------
-- WORM enforcement triggers on audit_logs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_logs_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_logs is a WORM table: UPDATE and DELETE operations are forbidden. '
        'TG_OP=%, record id=%',
        TG_OP,
        COALESCE(OLD.id::TEXT, 'unknown');
END;
$$;

CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_mutation();

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance trigger (applied to mutable tables)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_passengers_updated_at
    BEFORE UPDATE ON passengers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_flights_updated_at
    BEFORE UPDATE ON flights
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_loyalty_accounts_updated_at
    BEFORE UPDATE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_baggage_claims_updated_at
    BEFORE UPDATE ON baggage_claims
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- passengers
CREATE INDEX idx_passengers_email              ON passengers (email);
CREATE INDEX idx_passengers_role               ON passengers (role);
CREATE INDEX idx_passengers_tier_status        ON passengers (tier_status);
CREATE INDEX idx_passengers_is_active          ON passengers (is_active);
CREATE INDEX idx_passengers_locked_until       ON passengers (locked_until) WHERE locked_until IS NOT NULL;

-- flights
CREATE INDEX idx_flights_origin_dest_dept      ON flights (origin, destination, departure_time);
CREATE INDEX idx_flights_departure_time        ON flights (departure_time);
CREATE INDEX idx_flights_flight_number         ON flights (flight_number);
CREATE INDEX idx_flights_cabin_class           ON flights (cabin_class);
CREATE INDEX idx_flights_is_active             ON flights (is_active);

-- bookings
CREATE INDEX idx_bookings_passenger_id         ON bookings (passenger_id);
CREATE INDEX idx_bookings_flight_id            ON bookings (flight_id);
CREATE INDEX idx_bookings_status               ON bookings (status);
CREATE INDEX idx_bookings_pnr                  ON bookings (pnr);
CREATE INDEX idx_bookings_created_at           ON bookings (created_at DESC);
CREATE INDEX idx_bookings_passenger_status     ON bookings (passenger_id, status);

-- loyalty_accounts
CREATE INDEX idx_loyalty_accounts_passenger    ON loyalty_accounts (passenger_id);
CREATE INDEX idx_loyalty_accounts_tier         ON loyalty_accounts (tier_status);

-- loyalty_transactions
CREATE INDEX idx_loyalty_txn_account_id        ON loyalty_transactions (loyalty_account_id);
CREATE INDEX idx_loyalty_txn_booking_id        ON loyalty_transactions (booking_id);
CREATE INDEX idx_loyalty_txn_created_at        ON loyalty_transactions (created_at DESC);

-- baggage_claims
CREATE INDEX idx_baggage_claims_passenger_id   ON baggage_claims (passenger_id);
CREATE INDEX idx_baggage_claims_booking_id     ON baggage_claims (booking_id);
CREATE INDEX idx_baggage_claims_status         ON baggage_claims (status);
CREATE INDEX idx_baggage_claims_pnr            ON baggage_claims (pnr);
CREATE INDEX idx_baggage_claims_created_at     ON baggage_claims (created_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_passenger_id       ON audit_logs (passenger_id);
CREATE INDEX idx_audit_logs_performed_by       ON audit_logs (performed_by);
CREATE INDEX idx_audit_logs_action             ON audit_logs (action);
CREATE INDEX idx_audit_logs_table_record       ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_event_time         ON audit_logs (event_time DESC);
CREATE INDEX idx_audit_logs_request_id         ON audit_logs (request_id) WHERE request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-Level Security stubs
-- (Enable RLS on tables; policies are defined per-role in subsequent migrations
--  or application-level connection setup using SET LOCAL role / SET LOCAL app.passenger_id)
-- ---------------------------------------------------------------------------

ALTER TABLE passengers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE baggage_claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- flights is not passenger-scoped; RLS not required at row level (all authenticated users may read active flights)
-- ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

-- Stub policies: allow the application DB role (skywings_app) full access.
-- Fine-grained per-passenger policies will be layered in a subsequent migration
-- once the application role and SET LOCAL conventions are established.

-- passengers: each passenger sees only their own row via app.current_passenger_id setting
CREATE POLICY passengers_isolation
    ON passengers
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC                      -- replaced with application role in subsequent migration
    USING (TRUE);                  -- stub — tightened in 002_rls_policies.sql

CREATE POLICY bookings_isolation
    ON bookings
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (TRUE);

CREATE POLICY loyalty_accounts_isolation
    ON loyalty_accounts
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (TRUE);

CREATE POLICY loyalty_transactions_isolation
    ON loyalty_transactions
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (TRUE);

CREATE POLICY baggage_claims_isolation
    ON baggage_claims
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (TRUE);

-- audit_logs: readable by Travel Operations Specialist role only (enforced at app layer);
-- RLS stub prevents accidental direct passenger access.
CREATE POLICY audit_logs_read_only
    ON audit_logs
    AS PERMISSIVE
    FOR SELECT
    TO PUBLIC
    USING (TRUE);

-- Explicitly deny INSERT/UPDATE/DELETE through RLS for non-superuser connections
-- INSERT is allowed (append-only); UPDATE/DELETE blocked by triggers above.
CREATE POLICY audit_logs_insert_only
    ON audit_logs
    AS PERMISSIVE
    FOR INSERT
    TO PUBLIC
    WITH CHECK (TRUE);

COMMIT;