CREATE TABLE `accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`branch_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`town_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`simulation_tick` integer DEFAULT 0 NOT NULL,
	`month` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_branches_account` ON `branches` (`account_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`branch_version` integer NOT NULL,
	`event_type` text NOT NULL,
	`actor_seat_id` text NOT NULL,
	`origin` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_events_branch_version` ON `events` (`branch_id`,`branch_version`);--> statement-breakpoint
CREATE INDEX `idx_events_branch_created` ON `events` (`branch_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `idempotency_results` (
	`request_id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`actor_seat_id` text NOT NULL,
	`operation` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_branch_actor` ON `idempotency_results` (`branch_id`,`actor_seat_id`);--> statement-breakpoint
CREATE TABLE `seats` (
	`seat_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`active_branch_id` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_seats_account` ON `seats` (`account_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`seat_id` text NOT NULL,
	`role` text NOT NULL,
	`branch_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `stamps` (
	`stamp_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`actor_seat_id` text NOT NULL,
	`core_stamp_type_id` text NOT NULL,
	`target_ref` text NOT NULL,
	`scope` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_stamps_event` ON `stamps` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_stamps_branch_target` ON `stamps` (`branch_id`,`target_ref`);--> statement-breakpoint
PRAGMA optimize;
