CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`session_key` text NOT NULL,
	`flow_token_id` integer,
	`credits` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`last_sync_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_accounts_email_unique` ON `google_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `video_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt` text NOT NULL,
	`engine` text DEFAULT 'flow' NOT NULL,
	`orientation` text DEFAULT 'portrait' NOT NULL,
	`duration_sec` integer DEFAULT 8 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` text,
	`provider_name` text,
	`model` text,
	`file_path` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer
);
