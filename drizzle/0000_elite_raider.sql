CREATE TABLE `date_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`field` text NOT NULL,
	`old_date` text NOT NULL,
	`new_date` text NOT NULL,
	`reason` text NOT NULL,
	`actor_email` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`name` text NOT NULL,
	`due_date` text NOT NULL,
	`sequence` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po` text NOT NULL,
	`buyer_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`style` text NOT NULL,
	`color` text NOT NULL,
	`sizes_json` text NOT NULL,
	`qty` integer NOT NULL,
	`ex_factory` text NOT NULL,
	`unit_id` text NOT NULL,
	`stage` text NOT NULL,
	`stage_done` integer DEFAULT 0 NOT NULL,
	`baseline_daily` integer DEFAULT 0 NOT NULL,
	`buyer_warning_confirmed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_po_unique` ON `orders` (`po`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stage` text NOT NULL,
	`daily_qty` integer NOT NULL,
	`update_date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`english_summary` text,
	`category` text,
	`confidence` text,
	`photo_key` text,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`buyer_id` text,
	`unit_id` text,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
