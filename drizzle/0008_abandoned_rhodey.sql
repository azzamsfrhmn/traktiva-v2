CREATE TABLE `showcase_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`product_id` text NOT NULL,
	`title` text NOT NULL,
	`price` text NOT NULL,
	`original_price` text,
	`commission` text,
	`stock` integer,
	`in_stock` integer DEFAULT true NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`shop_name` text,
	`cover` text,
	`labels` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`synced_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_products_account_product` ON `showcase_products` (`account_id`,`product_id`);