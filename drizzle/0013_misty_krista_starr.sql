CREATE TABLE `todo_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`author_user_id` text,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `todo_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `todo_comments_item_idx` ON `todo_comments` (`item_id`);--> statement-breakpoint
ALTER TABLE `todo_items` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `todo_items` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` ADD `assignee_user_id` text REFERENCES user(id);