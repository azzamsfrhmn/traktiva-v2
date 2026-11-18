CREATE TABLE `video_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`preset_id` text NOT NULL,
	`title` text NOT NULL,
	`step` integer DEFAULT 1 NOT NULL,
	`product` text NOT NULL,
	`options` text NOT NULL,
	`scenes` text NOT NULL,
	`clip_sec` integer DEFAULT 6 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`progress` text,
	`error` text,
	`folder` text NOT NULL,
	`final_path` text,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
