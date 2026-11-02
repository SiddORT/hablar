CREATE TABLE "waitlist_signups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email_ciphertext" bytea,
  "email_lookup_hash" bytea,
  "phone_ciphertext" bytea,
  "phone_lookup_hash" bytea,
  "encryption_key_version" smallint NOT NULL DEFAULT 1,
  "consent_at" timestamptz NOT NULL DEFAULT now(),
  "consent_version" varchar(40) NOT NULL,
  "privacy_notice_version" varchar(40) NOT NULL,
  "terms_version" varchar(40) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "waitlist_email_lookup_hash_unique"
  ON "waitlist_signups" ("email_lookup_hash")
  WHERE "email_lookup_hash" IS NOT NULL;

CREATE UNIQUE INDEX "waitlist_phone_lookup_hash_unique"
  ON "waitlist_signups" ("phone_lookup_hash")
  WHERE "phone_lookup_hash" IS NOT NULL;

CREATE INDEX "waitlist_created_at_idx"
  ON "waitlist_signups" ("created_at");

CREATE TABLE "waitlist_email_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "signup_id" uuid NOT NULL REFERENCES "waitlist_signups"("id") ON DELETE CASCADE,
  "email_type" varchar(40) NOT NULL,
  "status" varchar(24) NOT NULL,
  "reason_code" varchar(48),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "attempted_at" timestamptz,
  "completed_at" timestamptz,
  CONSTRAINT "waitlist_email_logs_type_check"
      CHECK ("email_type" IN ('signup_confirmation', 'admin_signup_notice')),
  CONSTRAINT "waitlist_email_logs_status_check"
      CHECK ("status" IN ('queued', 'pending', 'accepted_by_smtp', 'failed', 'uncertain', 'skipped'))
);

CREATE INDEX "waitlist_email_logs_signup_created_idx"
  ON "waitlist_email_logs" ("signup_id", "created_at");

CREATE INDEX "waitlist_email_logs_status_created_idx"
  ON "waitlist_email_logs" ("status", "created_at");

CREATE TABLE "waitlist_launch_email_dispatches" (
  "campaign_id" varchar(80) PRIMARY KEY,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "attempted_count" integer NOT NULL DEFAULT 0,
  "accepted_count" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0
);