CREATE TABLE `case_file_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`case_file_id` text NOT NULL,
	`status` text NOT NULL,
	`changed_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`case_file_id`) REFERENCES `case_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `case_file_status_history_case_file_idx` ON `case_file_status_history` (`case_file_id`);--> statement-breakpoint
INSERT INTO `case_file_status_history` (`id`, `case_file_id`, `status`, `changed_by_user_id`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, 'needs_processing', `created_by_user_id`, `created_at` FROM `case_files`;--> statement-breakpoint
INSERT INTO `case_file_status_history` (`id`, `case_file_id`, `status`, `changed_by_user_id`, `created_at`)
SELECT lower(hex(randomblob(16))), `case_file_id`, 'sent_to_pvs', NULL, `created_at` FROM `case_file_submissions`;