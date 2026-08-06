CREATE TABLE `case_file_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_file_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`case_file_id`) REFERENCES `case_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `pvs_submission_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `case_file_submissions_case_file_idx` ON `case_file_submissions` (`case_file_id`);--> statement-breakpoint
CREATE INDEX `case_file_submissions_batch_idx` ON `case_file_submissions` (`batch_id`);--> statement-breakpoint
ALTER TABLE `case_files` ADD `return_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `case_files` ADD `last_returned_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `case_files_workspace_file_number_idx` ON `case_files` (`workspace_id`,`file_number`);