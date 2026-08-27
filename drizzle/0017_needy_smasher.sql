CREATE TABLE `icd10_alpha_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`term` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `icd10_alpha_terms_term_idx` ON `icd10_alpha_terms` (`term`);--> statement-breakpoint
CREATE INDEX `icd10_alpha_terms_code_idx` ON `icd10_alpha_terms` (`code`);