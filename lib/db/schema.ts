import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  role: text("role", { enum: ["user", "admin", "superadmin"] })
    .default("user")
    .notNull(),
  banned: integer("banned", { mode: "boolean" }).default(false).notNull(),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

export const trackers = sqliteTable(
  "trackers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#0f766e"),
    currency: text("currency").notNull().default("EUR"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("trackers_slug_idx").on(table.slug)]
);

export const trackerMembers = sqliteTable(
  "tracker_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission", {
      enum: ["owner", "write", "read"],
    })
      .notNull()
      .default("read"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("tracker_members_tracker_idx").on(table.trackerId),
    index("tracker_members_user_idx").on(table.userId),
    uniqueIndex("tracker_members_unique_idx").on(table.trackerId, table.userId),
  ]
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["expense", "income", "transfer"] })
      .notNull()
      .default("expense"),
    color: text("color").notNull().default("#475569"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("categories_tracker_idx").on(table.trackerId),
    uniqueIndex("categories_tracker_name_idx").on(table.trackerId, table.name),
  ]
);

export const payees = sqliteTable(
  "payees",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("payees_tracker_idx").on(table.trackerId),
    uniqueIndex("payees_tracker_name_idx").on(table.trackerId, table.name),
  ]
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    direction: text("direction", { enum: ["expense", "income"] }).notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    payeeId: text("payee_id").references(() => payees.id, {
      onDelete: "set null",
    }),
    customPayeeName: text("custom_payee_name"),
    notesTemplate: text("notes_template"),
    frequency: text("frequency", {
      enum: ["monthly", "yearly", "custom_days"],
    })
      .notNull()
      .default("monthly"),
    intervalValue: integer("interval_value").notNull().default(1),
    nextDueDate: text("next_due_date").notNull(),
    lastCompletedDate: text("last_completed_date"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    autoCreateDisabled: integer("auto_create_disabled", { mode: "boolean" })
      .default(true)
      .notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("schedules_tracker_idx").on(table.trackerId)]
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    accountName: text("account_name").notNull().default("Hauptkonto"),
    date: text("date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    direction: text("direction", { enum: ["expense", "income"] }).notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    payeeId: text("payee_id").references(() => payees.id, {
      onDelete: "set null",
    }),
    customPayeeName: text("custom_payee_name"),
    notes: text("notes"),
    source: text("source", { enum: ["manual", "schedule"] })
      .notNull()
      .default("manual"),
    scheduleId: text("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("transactions_tracker_idx").on(table.trackerId),
    index("transactions_date_idx").on(table.date),
  ]
);

export const appSettings = sqliteTable("app_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  valueJson: text("value_json").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamps.updatedAt,
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    severity: text("severity", {
      enum: ["info", "warning", "error", "critical"],
    })
      .notNull()
      .default("info"),
    metadataJson: text("metadata_json"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    isUserVisible: integer("is_user_visible", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_action_idx").on(table.action),
  ]
);

export const notificationEvents = sqliteTable("notification_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type", {
    enum: ["transaction_created", "schedule_attention", "admin_test"],
  }).notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] })
    .notNull()
    .default("pending"),
  payloadJson: text("payload_json").notNull(),
  responseCode: integer("response_code"),
  errorMessage: text("error_message"),
  createdByUserId: text("created_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamps.createdAt,
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  trackerMemberships: many(trackerMembers),
}));

export const trackerRelations = relations(trackers, ({ many }) => ({
  members: many(trackerMembers),
  categories: many(categories),
  payees: many(payees),
  schedules: many(schedules),
  transactions: many(transactions),
}));

export const trackerMemberRelations = relations(trackerMembers, ({ one }) => ({
  tracker: one(trackers, {
    fields: [trackerMembers.trackerId],
    references: [trackers.id],
  }),
  user: one(user, {
    fields: [trackerMembers.userId],
    references: [user.id],
  }),
}));

export type AppUser = typeof user.$inferSelect;
export type NewAppUser = typeof user.$inferInsert;
export type Tracker = typeof trackers.$inferSelect;
export type NewTracker = typeof trackers.$inferInsert;
export type TrackerMember = typeof trackerMembers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
