import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { auth } from "../lib/auth";
import { ensureBootstrapForUser } from "../lib/bootstrap";
import { db, sqlite } from "../lib/db";
import {
  appSettings,
  categories,
  payees,
  trackerMembers,
  trackers,
  transactions,
  user,
} from "../lib/db/schema";
import { slugify } from "../lib/utils";

const SEED_TAG = "[seed-demo-v1]";
const DEFAULT_PASSWORD = "test1111";

type SeedUserConfig = {
  name: string;
  email: string;
  password?: string;
  role?: "user" | "admin" | "superadmin";
};

type SeedTrackerConfig = {
  name: string;
  description: string;
  color: string;
  currency: string;
  sortOrder: number;
  memberships: Array<{
    userEmail: string;
    permission: "owner" | "write" | "read";
  }>;
  categories: Array<{
    name: string;
    type: "expense" | "income" | "transfer";
    color: string;
  }>;
  payees: string[];
  transactions: Array<{
    date: string;
    amountCents: number;
    direction: "expense" | "income";
    categoryName: string;
    payeeName: string;
    notes: string;
    createdByEmail: string;
    accountName?: string;
  }>;
};

const seedUsers: SeedUserConfig[] = [
  {
    name: "Test User",
    email: "test@test.de",
    password: DEFAULT_PASSWORD,
    role: "superadmin",
  },
  {
    name: "Anna Becker",
    email: "anna@example.test",
    password: DEFAULT_PASSWORD,
    role: "admin",
  },
  {
    name: "Max Fischer",
    email: "max@example.test",
    password: DEFAULT_PASSWORD,
    role: "user",
  },
  {
    name: "Clara Neumann",
    email: "clara@example.test",
    password: DEFAULT_PASSWORD,
    role: "user",
  },
];

const seedTrackers: SeedTrackerConfig[] = [
  {
    name: "Privatkasse",
    description: "Persoenliche Alltagsausgaben und Einnahmen.",
    color: "#0f766e",
    currency: "EUR",
    sortOrder: 0,
    memberships: [
      { userEmail: "test@test.de", permission: "owner" },
      { userEmail: "anna@example.test", permission: "write" },
      { userEmail: "max@example.test", permission: "read" },
    ],
    categories: [
      { name: "Gehalt", type: "income", color: "#059669" },
      { name: "Supermarkt", type: "expense", color: "#dc2626" },
      { name: "Freizeit", type: "expense", color: "#7c3aed" },
      { name: "Miete", type: "expense", color: "#2563eb" },
    ],
    payees: ["Arbeitgeber GmbH", "Bio Markt", "Kino Central", "Hausverwaltung Nord"],
    transactions: [
      {
        date: "2026-06-01",
        amountCents: 285000,
        direction: "income",
        categoryName: "Gehalt",
        payeeName: "Arbeitgeber GmbH",
        notes: `${SEED_TAG} Monatsgehalt Juni`,
        createdByEmail: "test@test.de",
      },
      {
        date: "2026-06-02",
        amountCents: 6499,
        direction: "expense",
        categoryName: "Supermarkt",
        payeeName: "Bio Markt",
        notes: `${SEED_TAG} Wocheneinkauf`,
        createdByEmail: "anna@example.test",
      },
      {
        date: "2026-06-03",
        amountCents: 1299,
        direction: "expense",
        categoryName: "Freizeit",
        payeeName: "Kino Central",
        notes: `${SEED_TAG} Filmabend`,
        createdByEmail: "anna@example.test",
      },
      {
        date: "2026-06-04",
        amountCents: 97500,
        direction: "expense",
        categoryName: "Miete",
        payeeName: "Hausverwaltung Nord",
        notes: `${SEED_TAG} Warmmiete`,
        createdByEmail: "test@test.de",
      },
      {
        date: "2026-06-07",
        amountCents: 2299,
        direction: "expense",
        categoryName: "Supermarkt",
        payeeName: "Bio Markt",
        notes: `${SEED_TAG} Snacks und Getraenke`,
        createdByEmail: "max@example.test",
      },
      {
        date: "2026-06-09",
        amountCents: 1899,
        direction: "expense",
        categoryName: "Freizeit",
        payeeName: "Kino Central",
        notes: `${SEED_TAG} Streaming und Apps`,
        createdByEmail: "clara@example.test",
      },
    ],
  },
  {
    name: "WG-Kasse",
    description: "Gemeinsame Ausgaben fuer Haushalt und Einkaeufe.",
    color: "#2563eb",
    currency: "EUR",
    sortOrder: 1,
    memberships: [
      { userEmail: "test@test.de", permission: "owner" },
      { userEmail: "anna@example.test", permission: "owner" },
      { userEmail: "max@example.test", permission: "write" },
      { userEmail: "clara@example.test", permission: "write" },
    ],
    categories: [
      { name: "Haushalt", type: "expense", color: "#0ea5e9" },
      { name: "Lebensmittel", type: "expense", color: "#f97316" },
      { name: "Einzahlungen", type: "income", color: "#16a34a" },
      { name: "Internet", type: "expense", color: "#475569" },
    ],
    payees: ["Drogerie Plus", "Grossmarkt", "Mitbewohner", "Provider AG"],
    transactions: [
      {
        date: "2026-06-01",
        amountCents: 12000,
        direction: "income",
        categoryName: "Einzahlungen",
        payeeName: "Mitbewohner",
        notes: `${SEED_TAG} Monatsbeitrag Anna`,
        createdByEmail: "anna@example.test",
      },
      {
        date: "2026-06-01",
        amountCents: 12000,
        direction: "income",
        categoryName: "Einzahlungen",
        payeeName: "Mitbewohner",
        notes: `${SEED_TAG} Monatsbeitrag Max`,
        createdByEmail: "max@example.test",
      },
      {
        date: "2026-06-02",
        amountCents: 4599,
        direction: "expense",
        categoryName: "Haushalt",
        payeeName: "Drogerie Plus",
        notes: `${SEED_TAG} Putzmittel und Papier`,
        createdByEmail: "clara@example.test",
      },
      {
        date: "2026-06-03",
        amountCents: 8799,
        direction: "expense",
        categoryName: "Lebensmittel",
        payeeName: "Grossmarkt",
        notes: `${SEED_TAG} Wochenendeinkauf`,
        createdByEmail: "max@example.test",
      },
      {
        date: "2026-06-05",
        amountCents: 3499,
        direction: "expense",
        categoryName: "Internet",
        payeeName: "Provider AG",
        notes: `${SEED_TAG} Internet Juni`,
        createdByEmail: "test@test.de",
      },
      {
        date: "2026-06-08",
        amountCents: 2199,
        direction: "expense",
        categoryName: "Haushalt",
        payeeName: "Drogerie Plus",
        notes: `${SEED_TAG} Ersatz fuer Kueche`,
        createdByEmail: "anna@example.test",
      },
    ],
  },
];

async function ensureRegistrationEnabled() {
  const existing = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.key, "registrationEnabled"))
    .limit(1);

  if (existing[0]) {
    await db
      .update(appSettings)
      .set({
        valueJson: JSON.stringify(true),
        updatedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(appSettings.id, existing[0].id));
    return;
  }

  await db.insert(appSettings).values({
    key: "registrationEnabled",
    valueJson: JSON.stringify(true),
    updatedByUserId: null,
  });
}

async function ensureUser(config: SeedUserConfig) {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, config.email))
    .limit(1);

  if (!existing[0]) {
    await auth.api.signUpEmail({
      body: {
        name: config.name,
        email: config.email,
        password: config.password ?? DEFAULT_PASSWORD,
      },
    });
  }

  const [createdOrExisting] = await db
    .select()
    .from(user)
    .where(eq(user.email, config.email))
    .limit(1);

  if (!createdOrExisting) {
    throw new Error(`Could not create or load user ${config.email}`);
  }

  if (config.role && createdOrExisting.role !== config.role) {
    await db
      .update(user)
      .set({
        role: config.role,
        updatedAt: new Date(),
      })
      .where(eq(user.id, createdOrExisting.id));

    createdOrExisting.role = config.role;
  }

  return createdOrExisting;
}

async function ensureTracker(config: SeedTrackerConfig) {
  const slug = slugify(config.name);
  const [existing] = await db
    .select()
    .from(trackers)
    .where(eq(trackers.slug, slug))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(trackers)
    .values({
      name: config.name,
      slug,
      description: config.description,
      color: config.color,
      currency: config.currency,
      sortOrder: config.sortOrder,
    })
    .returning();

  return created;
}

async function ensureTrackerMembership(
  trackerId: string,
  userId: string,
  permission: "owner" | "write" | "read"
) {
  const [existing] = await db
    .select()
    .from(trackerMembers)
    .where(and(eq(trackerMembers.trackerId, trackerId), eq(trackerMembers.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.permission !== permission) {
      await db
        .update(trackerMembers)
        .set({ permission })
        .where(eq(trackerMembers.id, existing.id));
    }
    return;
  }

  await db.insert(trackerMembers).values({
    trackerId,
    userId,
    permission,
  });
}

async function ensureCategory(
  trackerId: string,
  definition: SeedTrackerConfig["categories"][number]
) {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.trackerId, trackerId), eq(categories.name, definition.name)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(categories)
    .values({
      trackerId,
      name: definition.name,
      type: definition.type,
      color: definition.color,
    })
    .returning();

  return created;
}

async function ensurePayee(trackerId: string, name: string) {
  const [existing] = await db
    .select()
    .from(payees)
    .where(and(eq(payees.trackerId, trackerId), eq(payees.name, name)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(payees)
    .values({
      trackerId,
      name,
    })
    .returning();

  return created;
}

async function seedTrackerTransactions(
  trackerId: string,
  trackerName: string,
  definitions: SeedTrackerConfig["transactions"],
  categoryByName: Map<string, string>,
  payeeByName: Map<string, string>,
  userByEmail: Map<string, string>
) {
  const [existingSeedRow] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.trackerId, trackerId), like(transactions.notes, `%${SEED_TAG}%`)))
    .limit(1);

  if (existingSeedRow) {
    return 0;
  }

  await db.insert(transactions).values(
    definitions.map((entry) => {
      const createdByUserId = userByEmail.get(entry.createdByEmail);
      const categoryId = categoryByName.get(entry.categoryName);
      const payeeId = payeeByName.get(entry.payeeName);

      if (!createdByUserId) {
        throw new Error(`Missing seeded user for ${entry.createdByEmail}`);
      }
      if (!categoryId) {
        throw new Error(`Missing category ${entry.categoryName} for ${trackerName}`);
      }
      if (!payeeId) {
        throw new Error(`Missing payee ${entry.payeeName} for ${trackerName}`);
      }

      return {
        trackerId,
        accountName: entry.accountName ?? trackerName,
        date: entry.date,
        amountCents: entry.amountCents,
        direction: entry.direction,
        categoryId,
        payeeId,
        customPayeeName: null,
        notes: entry.notes,
        source: "manual" as const,
        scheduleId: null,
        createdByUserId,
      };
    })
  );

  return definitions.length;
}

async function main() {
  await ensureRegistrationEnabled();

  const createdUsers = new Map<string, string>();
  for (const config of seedUsers) {
    const seededUser = await ensureUser(config);
    createdUsers.set(config.email, seededUser.id);
  }

  const firstUserId = createdUsers.get("test@test.de");
  if (!firstUserId) {
    throw new Error("Missing seeded primary user");
  }

  await ensureBootstrapForUser(firstUserId);

  let insertedTransactions = 0;

  for (const trackerConfig of seedTrackers) {
    const tracker = await ensureTracker(trackerConfig);

    for (const membership of trackerConfig.memberships) {
      const userId = createdUsers.get(membership.userEmail);
      if (!userId) {
        throw new Error(`Missing seeded membership user ${membership.userEmail}`);
      }
      await ensureTrackerMembership(tracker.id, userId, membership.permission);
    }

    const categoryByName = new Map<string, string>();
    for (const category of trackerConfig.categories) {
      const savedCategory = await ensureCategory(tracker.id, category);
      categoryByName.set(savedCategory.name, savedCategory.id);
    }

    const payeeByName = new Map<string, string>();
    for (const payeeName of trackerConfig.payees) {
      const savedPayee = await ensurePayee(tracker.id, payeeName);
      payeeByName.set(savedPayee.name, savedPayee.id);
    }

    insertedTransactions += await seedTrackerTransactions(
      tracker.id,
      tracker.name,
      trackerConfig.transactions,
      categoryByName,
      payeeByName,
      createdUsers
    );
  }

  console.log("Seed complete.");
  console.log(`Users available: ${seedUsers.map((entry) => entry.email).join(", ")}`);
  console.log(`Login for primary user: test@test.de / ${DEFAULT_PASSWORD}`);
  console.log(`Trackers ensured: ${seedTrackers.map((entry) => entry.name).join(", ")}`);
  console.log(`Transactions inserted this run: ${insertedTransactions}`);
}

main()
  .catch((error) => {
    console.error("Seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    sqlite.close();
  });
