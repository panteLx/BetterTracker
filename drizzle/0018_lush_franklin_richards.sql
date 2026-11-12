CREATE TABLE `ops_codes` (
	`ops_code` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`operation` text,
	`monitoring` text,
	`anesthesia` text,
	`funding` text,
	`hygiene` text,
	`aop_115b` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ops_hybrid_codes` (
	`ops_code` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL
);
