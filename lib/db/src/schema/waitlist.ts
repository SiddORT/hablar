import {
  customType,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const waitlistSignupsTable = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailCiphertext: bytea("email_ciphertext"),
    emailLookupHash: bytea("email_lookup_hash"),
    phoneCiphertext: bytea("phone_ciphertext"),
    phoneLookupHash: bytea("phone_lookup_hash"),
    encryptionKeyVersion: smallint("encryption_key_version").notNull().default(1),
    consentAt: timestamp("consent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    consentVersion: varchar("consent_version", { length: 40 }).notNull(),
    privacyNoticeVersion: varchar("privacy_notice_version", { length: 40 }).notNull(),
    termsVersion: varchar("terms_version", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("waitlist_email_lookup_hash_unique")
      .on(table.emailLookupHash)
      .where(sql`${table.emailLookupHash} is not null`),
    uniqueIndex("waitlist_phone_lookup_hash_unique")
      .on(table.phoneLookupHash)
      .where(sql`${table.phoneLookupHash} is not null`),
    index("waitlist_created_at_idx").on(table.createdAt),
  ],
);

export const waitlistLaunchEmailDispatchesTable = pgTable(
  "waitlist_launch_email_dispatches",
  {
    campaignId: varchar("campaign_id", { length: 80 }).primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    attemptedCount: integer("attempted_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
  },
);
