-- Migration: 001_initial_schema.sql
-- Creates initial schema for SkyWings passenger management system
-- Tables: passengers, flights, bookings, seat_assignments, loyalty_accounts, baggage_claims, audit_logs

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Enum Types
-- ============================================================

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
    'cancelled',
    'completed',
    'rebooking'
);

CREATE TYPE payment_method AS ENUM (
    'card',
    'miles',
    'mixed'
);

CREATE TYPE seat_position AS ENUM (
    'window',
    'middle',
    'aisle'
);

CREATE TYPE seat_status AS ENUM (
    'reserved',
    'available',
    'blocked'
);

CREATE TYPE baggage_incident_type AS ENUM (
    'delayed',
    'damaged',
    'lost',
    'pilfered'
);

CREATE TYPE claim_status AS ENUM (
    'submitted',
    'under_review',
    'pending_documentation',
    'resolved',
    'rejected',
    'closed'
);

CREATE TYPE flight_status AS ENUM (
    'scheduled',
    'boarding',
    'departed',
    'arrived',
    'delayed',
    'cancelled'
);

CREATE TYPE loyalty_transaction_type AS ENUM (
    'earn',
    'redeem',
    'expire',
    'transfer',
    'bonus',
    'adjustment'
);

CREATE TYPE audit_action AS ENUM (
    'create',
    'read',
    'update',
    'delete',
    'login',
    'logout',
    'export',
    'checkin',
    'redeem',
    'claim_submit'
);

CREATE TYPE preferred_language AS ENUM (
    'en',
    'ar'
);

-- ============================================================
-- Table: passengers
-- ============================================================

CREATE TABLE passengers (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(320)    NOT NULL,
    password_hash       TEXT            NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    phone               VARCHAR(30),
    document_url        TEXT,
    nationality         VARCHAR(100),
    date_of_birth       DATE,
    role                passenger_role  NOT NULL DEFAULT 'Leisure Passenger',
    tier_status         tier_status     NOT NULL DEFAULT 'standard',
    preferred_language  preferred_language NOT NULL DEFAULT 'en',
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER       NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    otp_secret          TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_passengers_email ON passengers (email);
CREATE INDEX idx_passengers_tier_status ON passengers (tier_status);
CREATE INDEX idx_passengers_role ON passengers (role);
CREATE INDEX idx_passengers_is_active ON passengers (is_active);
CREATE INDEX idx_passengers_created_at ON passengers (created_at);

-- ============================================================
-- Table: flights
-- ============================================================

CREATE TABLE flights (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_number       VARCHAR(20)     NOT NULL,
    origin              CHAR(3)         NOT NULL,
    destination         CHAR(3)         NOT NULL,
    departure_time      TIMESTAMPTZ     NOT NULL,
    arrival_time        TIMESTAMPTZ     NOT NULL,
    cabin_class         cabin_class     NOT NULL DEFAULT 'economy',
    aircraft_type       VARCHAR(50),
    total_seats         INTEGER         NOT NULL CHECK (total_seats > 0),
    available_seats     INTEGER         NOT NULL CHECK (available_seats >= 0),
    base_fare_usd       NUMERIC(12, 2)  NOT NULL CHECK (base_fare_usd >= 0),
    miles_price         INTEGER         CHECK (miles_price >= 0),
    status              flight_status   NOT NULL DEFAULT 'scheduled',
    gds_ref             VARCHAR(50),
    gds_synced_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_flight_times CHECK (arrival_time > departure_time),
    CONSTRAINT chk_available_seats CHECK (available_seats <= total_seats)
);

CREATE INDEX idx_flights_flight_number ON flights (flight_number);
CREATE INDEX idx_flights_origin ON flights (origin);
CREATE INDEX idx_flights_destination ON flights (destination);
CREATE INDEX idx_flights_departure_time ON flights (departure_time);
CREATE INDEX idx_flights_status ON flights (status);
CREATE INDEX idx_flights_cabin_class ON flights (cabin_class);
CREATE INDEX idx_flights_origin_destination_departure ON flights (origin, destination, departure_time);

-- ============================================================
-- Table: bookings
-- ============================================================

CREATE TABLE bookings (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pnr                 VARCHAR(10)     NOT NULL,
    passenger_id        UUID            NOT NULL REFERENCES passengers (id) ON DELETE RESTRICT,
    flight_id           UUID            NOT NULL REFERENCES flights (id) ON DELETE RESTRICT,
    status              booking_status  NOT NULL DEFAULT 'pending',
    cabin_class         cabin_class     NOT NULL,
    payment_method      payment_method  NOT NULL,
    fare_usd            NUMERIC(12, 2),
    miles_used          INTEGER         NOT NULL DEFAULT 0 CHECK (miles_used >= 0),
    miles_earned        INTEGER         NOT NULL DEFAULT 0 CHECK (miles_earned >= 0),
    checkin_eligible    BOOLEAN         NOT NULL DEFAULT FALSE,
    checked_in_at       TIMESTAMPTZ,
    boarding_pass_url   TEXT,
    rebooking_of        UUID            REFERENCES bookings (id) ON DELETE SET NULL,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bookings_pnr ON bookings (pnr);
CREATE INDEX idx_bookings_passenger_id ON bookings (passenger_id);
CREATE INDEX idx_bookings_flight_id ON bookings (flight_id);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_created_at ON bookings (created_at);
CREATE INDEX idx_bookings_passenger_status ON bookings (passenger_id, status);

-- ============================================================
-- Table: seat_assignments
-- ============================================================

CREATE TABLE seat_assignments (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id          UUID            NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    flight_id           UUID            NOT NULL REFERENCES flights (id) ON DELETE RESTRICT,
    passenger_id        UUID            NOT NULL REFERENCES passengers (id) ON DELETE RESTRICT,
    seat_number         VARCHAR(5)      NOT NULL,
    seat_position       seat_position,
    seat_status         seat_status     NOT NULL DEFAULT 'reserved',
    deck                VARCHAR(10)     DEFAULT 'main',
    assigned_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_seat_flight UNIQUE (flight_id, seat_number)
);

CREATE INDEX idx_seat_assignments_booking_id ON seat_assignments (booking_id);
CREATE INDEX idx_seat_assignments_flight_id ON seat_assignments (flight_id);
CREATE INDEX idx_seat_assignments_passenger_id ON seat_assignments (passenger_id);
CREATE INDEX idx_seat_assignments_seat_status ON seat_assignments (seat_status);

-- ============================================================
-- Table: loyalty_accounts
-- ============================================================

CREATE TABLE loyalty_accounts (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id            UUID            NOT NULL REFERENCES passengers (id) ON DELETE CASCADE,
    miles_balance           INTEGER         NOT NULL DEFAULT 0 CHECK (miles_balance >= 0),
    lifetime_miles_earned   INTEGER         NOT NULL DEFAULT 0 CHECK (lifetime_miles_earned >= 0),
    tier_status             tier_status     NOT NULL DEFAULT 'standard',
    tier_valid_until        DATE,
    last_activity_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loyalty_passenger UNIQUE (passenger_id)
);

CREATE INDEX idx_loyalty_accounts_passenger_id ON loyalty_accounts (passenger_id);
CREATE INDEX idx_loyalty_accounts_tier_status ON loyalty_accounts (tier_status);
CREATE INDEX idx_loyalty_accounts_miles_balance ON loyalty_accounts (miles_balance);

-- ============================================================
-- Table: loyalty_transactions
-- (Tracks individual earn/redeem events linked to loyalty_accounts)
-- ============================================================

CREATE TABLE loyalty_transactions (
    id                  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_account_id  UUID                    NOT NULL REFERENCES loyalty_accounts (id) ON DELETE CASCADE,
    passenger_id        UUID                    NOT NULL REFERENCES passengers (id) ON DELETE RESTRICT,
    booking_id          UUID                    REFERENCES bookings (id) ON DELETE SET NULL,
    transaction_type    loyalty_transaction_type NOT NULL,
    miles_delta         INTEGER                 NOT NULL,
    balance_after       INTEGER                 NOT NULL CHECK (balance_after >= 0),
    service_type        VARCHAR(50),
    description         TEXT,
    external_ref        VARCHAR(100),
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loyalty_transactions_loyalty_account_id ON loyalty_transactions (loyalty_account_id);
CREATE INDEX idx_loyalty_transactions_passenger_id ON loyalty_transactions (passenger_id);
CREATE INDEX idx_loyalty_transactions_booking_id ON loyalty_transactions (booking_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions (transaction_type);
CREATE INDEX idx_loyalty_transactions_created_at ON loyalty_transactions (created_at);

-- ============================================================
-- Table: baggage_claims
-- ============================================================

CREATE TABLE baggage_claims (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id         VARCHAR(20)         NOT NULL,
    passenger_id        UUID                NOT NULL REFERENCES passengers (id) ON DELETE RESTRICT,
    booking_id          UUID                REFERENCES bookings (id) ON DELETE SET NULL,
    pnr                 VARCHAR(10)         NOT NULL,
    incident_type       baggage_incident_type NOT NULL,
    description         TEXT                NOT NULL,
    file_urls           TEXT[]              NOT NULL DEFAULT '{}',
    status              claim_status        NOT NULL DEFAULT 'submitted',
    assigned_to         UUID                REFERENCES passengers (id) ON DELETE SET NULL,
    resolution_notes    TEXT,
    resolved_at         TIMESTAMPTZ,
    acknowledgment_sent BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_baggage_claims_tracking_id ON baggage_claims (tracking_id);
CREATE INDEX idx_baggage_claims_passenger_id ON baggage_claims (passenger_id);
CREATE INDEX idx_baggage_claims_booking_id ON baggage_claims (booking_id);
CREATE INDEX idx_baggage_claims_pnr ON baggage_claims (pnr);
CREATE INDEX idx_baggage_claims_status ON baggage_claims (status);
CREATE INDEX idx_baggage_claims_incident_type ON baggage_claims (incident_type);
CREATE INDEX idx_baggage_claims_created_at ON baggage_claims (created_at);

-- ============================================================
-- Table: baggage_claim_timeline
-- (Status history / operational updates for a claim)
-- ============================================================

CREATE TABLE baggage_claim_timeline (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id        UUID            NOT NULL REFERENCES baggage_claims (id) ON DELETE CASCADE,
    status          claim_status    NOT NULL,
    note            TEXT,
    updated_by      UUID            REFERENCES passengers (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_timeline_claim_id ON baggage_claim_timeline (claim_id);
CREATE INDEX idx_claim_timeline_created_at ON baggage_claim_timeline (created_at);

-- ============================================================
-- Table: audit_logs
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id        UUID            REFERENCES passengers (id) ON DELETE SET NULL,
    actor_role      passenger_role,
    action          audit_action    NOT NULL,
    resource_type   VARCHAR(80)     NOT NULL,
    resource_id     UUID,
    request_id      VARCHAR(60),
    ip_address      INET,
    user_agent      TEXT,
    payload         JSONB,
    outcome         VARCHAR(20)     NOT NULL DEFAULT 'success',
    error_message   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs (resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs (resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_actor_action ON audit_logs (actor_id, action);
CREATE INDEX idx_audit_logs_payload_gin ON audit_logs USING GIN (payload);

-- ============================================================
-- Table: refresh_tokens
-- (Tracks issued HttpOnly refresh tokens for rotation/revocation)
-- ============================================================

CREATE TABLE refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id    UUID            NOT NULL REFERENCES passengers (id) ON DELETE CASCADE,
    token_hash      TEXT            NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    issued_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    ip_address      INET,
    user_agent      TEXT
);

CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_passenger_id ON refresh_tokens (passenger_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens (revoked);

-- ============================================================
-- Triggers: updated_at auto-maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_passengers_updated_at
    BEFORE UPDATE ON passengers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_flights_updated_at
    BEFORE UPDATE ON flights
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_seat_assignments_updated_at
    BEFORE UPDATE ON seat_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_loyalty_accounts_updated_at
    BEFORE UPDATE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_baggage_claims_updated_at
    BEFORE UPDATE ON baggage_claims
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();