CREATE TABLE `letter_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`date` text NOT NULL,
	`checked_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checked_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letter_checks_workspace_date_idx` ON `letter_checks` (`workspace_id`,`date`);