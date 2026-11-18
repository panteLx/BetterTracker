CREATE TABLE `pathology_list_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`list_id` text NOT NULL,
	`position` integer NOT NULL,
	`sample_number` text NOT NULL,
	`patient_name` text NOT NULL,
	`date_of_birth` text,
	`received_date` text,
	`liquid` text,
	`sender` text,
	`material` text,
	`is_cancer_registry` integer DEFAULT false NOT NULL,
	`treatment_type` text,
	`insurer` text,
	`insurance_number` text,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `pathology_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pathology_entries_list_idx` ON `pathology_list_entries` (`list_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pathology_entries_workspace_sample_idx` ON `pathology_list_entries` (`workspace_id`,`sample_number`);--> statement-breakpoint
CREATE TABLE `pathology_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`source_file_name` text NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pathology_lists_workspace_idx` ON `pathology_lists` (`workspace_id`);