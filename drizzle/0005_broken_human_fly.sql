CREATE TABLE `case_file_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`case_file_id` text NOT NULL,
	`author_user_id` text,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`case_file_id`) REFERENCES `case_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `case_file_comments_case_file_idx` ON `case_file_comments` (`case_file_id`);--> statement-breakpoint
CREATE TABLE `case_files` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`file_number` text NOT NULL,
	`date_of_birth` text,
	`case_type` text NOT NULL,
	`status` text DEFAULT 'needs_processing' NOT NULL,
	`submission_batch_id` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_batch_id`) REFERENCES `pvs_submission_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `case_files_workspace_idx` ON `case_files` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `case_files_status_idx` ON `case_files` (`status`);--> statement-breakpoint
CREATE INDEX `case_files_batch_idx` ON `case_files` (`submission_batch_id`);--> statement-breakpoint
CREATE INDEX `case_files_file_number_idx` ON `case_files` (`file_number`);--> statement-breakpoint
CREATE TABLE `case_workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`permission` text DEFAULT 'read' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `case_workspace_members_workspace_idx` ON `case_workspace_members` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `case_workspace_members_user_idx` ON `case_workspace_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `case_workspace_members_unique_idx` ON `case_workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `case_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#0f766e' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_workspaces_slug_idx` ON `case_workspaces` (`slug`);--> statement-breakpoint
CREATE TABLE `pvs_submission_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`submitted_on` text NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pvs_submission_batches_workspace_idx` ON `pvs_submission_batches` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `pvs_submission_batches_submitted_on_idx` ON `pvs_submission_batches` (`submitted_on`);