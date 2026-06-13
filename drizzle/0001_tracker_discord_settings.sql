ALTER TABLE `trackers` ADD `discord_webhook_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `trackers` ADD `discord_debug_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trackers` ADD `discord_ping_role_id` text DEFAULT '' NOT NULL;