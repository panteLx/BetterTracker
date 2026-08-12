ALTER TABLE `payees` ADD `track_weight` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trackers` ADD `weight_tracking_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `weight_grams` integer;