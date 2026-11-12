CREATE TABLE `ops_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`ops_code` text NOT NULL,
	`description` text NOT NULL,
	`is_hybrid` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-530.03', 'Leistenhernie ohne plastischen Bruchpfortenverschluss', 1, 0);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-530.1', 'Leistenhernie mit plastischem Bruchpfortenverschluss', 1, 1);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-530.31', 'Leistenhernie (TAPP)', 1, 2);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-530.33', 'Leistenhernie Lichtenstein', 1, 3);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-535.0', 'epigastrische Hernie', 1, 4);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-534.03', 'supraumbilical Hernie ohne plastischen Bruchpfortenverschluss', 1, 5);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-534.1', 'Supraumbilical Hernie mit plastischem Bruchpfortenverschluss', 1, 6);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-897.0', 'Excision und Rekostruktion: Sinus pilonidalis', 1, 7);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-490.1', 'Inzision und Exzision Gewebe der Perianalregion', 1, 8);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-491.11', 'Intersphinktäre Analfistel', 1, 9);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-491.12', 'Transsphinktäre Analfistel', 1, 10);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-492.00', 'Perianalabszess', 1, 11);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-493.2', 'Hämorrhoiden-OP Milligan Morgan', 0, 12);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-482.10', 'Submuköse Exzision Peranal', 0, 13);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-850.66', 'Incision Bauchregion', 0, 14);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-850.65', 'Incision Brustwand und Rücken', 0, 15);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.60', 'Excision Kopf und Hals', 0, 16);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.61', 'Excision Schulter und Axilla', 0, 17);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.65', 'Excision Brustwand und Rücken', 0, 18);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.66', 'Excision Bauchregion', 0, 19);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.67', 'Excision Leisten-,Genital-,Gesäßabszess', 0, 20);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-852.68', 'Excision Oberschenkel und Knie', 0, 21);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-399.5', 'Portimplantation', 0, 22);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-399.7', 'Portexplantation', 0, 23);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-493.20', 'Hämorrhoiden', 0, 24);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-493.71', 'HAL RAR OP', 0, 25);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-903.1c', 'VAC Leisten-und Genitalregion', 0, 26);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '5-903.1b', 'VAC Bauchregion', 0, 27);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '1-586.0', 'Biopsie Lymphknoten Zervikal', 1, 28);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '1-586.1', 'Biopsie Lymphknoten Supraklavkulär', 0, 29);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '1-586.2', 'Biopsie Lymphknoten Axillär', 0, 30);
--> statement-breakpoint
INSERT INTO `ops_favorites` (`id`, `ops_code`, `description`, `is_hybrid`, `sort_order`) VALUES (lower(hex(randomblob(16))), '1-586.6', 'Biopsie Lymphknoten Inguinal', 1, 31);
