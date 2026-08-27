CREATE TABLE `icd10_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`group_title` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `icd10_codes_title_idx` ON `icd10_codes` (`title`);