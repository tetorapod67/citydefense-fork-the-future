import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  accountId: text("account_id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const branches = sqliteTable("branches", {
  branchId: text("branch_id").primaryKey(),
  accountId: text("account_id").notNull(),
  townId: text("town_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(0),
  simulationTick: integer("simulation_tick").notNull().default(0),
  month: integer("month").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_branches_account").on(table.accountId)]);

export const seats = sqliteTable("seats", {
  seatId: text("seat_id").primaryKey(),
  accountId: text("account_id").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name").notNull(),
  activeBranchId: text("active_branch_id").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_seats_account").on(table.accountId)]);

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: text("account_id").notNull(),
  seatId: text("seat_id").notNull(),
  role: text("role").notNull(),
  branchId: text("branch_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("idx_sessions_expiry").on(table.expiresAt)]);

export const events = sqliteTable("events", {
  eventId: text("event_id").primaryKey(),
  branchId: text("branch_id").notNull(),
  branchVersion: integer("branch_version").notNull(),
  eventType: text("event_type").notNull(),
  actorSeatId: text("actor_seat_id").notNull(),
  origin: text("origin").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("uq_events_branch_version").on(table.branchId, table.branchVersion),
  index("idx_events_branch_created").on(table.branchId, table.createdAt),
]);

export const stamps = sqliteTable("stamps", {
  stampId: text("stamp_id").primaryKey(),
  eventId: text("event_id").notNull(),
  branchId: text("branch_id").notNull(),
  actorSeatId: text("actor_seat_id").notNull(),
  coreStampTypeId: text("core_stamp_type_id").notNull(),
  targetRef: text("target_ref").notNull(),
  scope: text("scope").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("uq_stamps_event").on(table.eventId),
  index("idx_stamps_branch_target").on(table.branchId, table.targetRef),
]);

export const idempotencyResults = sqliteTable("idempotency_results", {
  requestId: text("request_id").primaryKey(),
  branchId: text("branch_id").notNull(),
  actorSeatId: text("actor_seat_id").notNull(),
  operation: text("operation").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_idempotency_branch_actor").on(table.branchId, table.actorSeatId)]);
