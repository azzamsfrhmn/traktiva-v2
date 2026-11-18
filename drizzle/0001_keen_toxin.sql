ALTER TABLE `accounts` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `session_key` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `last_check_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_platform_external_id` ON `accounts` (`platform`,`external_id`);