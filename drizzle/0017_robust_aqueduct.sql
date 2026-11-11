CREATE TABLE `case_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`original_file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `case_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `case_invoices_workspace_idx` ON `case_invoices` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `case_files` ADD `invoice_id` text REFERENCES case_invoices(id);--> statement-breakpoint
CREATE INDEX `case_files_invoice_idx` ON `case_files` (`invoice_id`);