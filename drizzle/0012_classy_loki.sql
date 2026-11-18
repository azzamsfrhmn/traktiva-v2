CREATE TABLE `saved_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`country` text DEFAULT 'ID' NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`image` text,
	`price` text,
	`shop_name` text,
	`metrics` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_products_product_country` ON `saved_products` (`product_id`,`country`);