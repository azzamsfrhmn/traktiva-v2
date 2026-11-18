CREATE TABLE `kalo_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`session_cookie` text NOT NULL,
	`email` text,
	`device_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`quota_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kalo_sessions_session_cookie_unique` ON `kalo_sessions` (`session_cookie`);--> statement-breakpoint
CREATE TABLE `kv_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`captured_at` integer DEFAULT (unixepoch()) NOT NULL
);
