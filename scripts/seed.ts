import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { auth } from "../lib/auth";
import { ensureBootstrapForUser } from "../lib/bootstrap";
import { addInterval } from "../lib/date";
import { db, sqlite } from "../lib/db";
import {
  appSettings,
  categories,
  payees,
  schedules,
  trackerMembers,
  trackers,
  transactions,
  user,
} from "../lib/db/schema";
import { slugify, toDateInputValue } from "../lib/utils";

const SEED_TAG = "[seed-demo-v2]";
const DEFAULT_PASSWORD = "demo12345";
const TRANSACTION_BATCH_SIZE = 200;

type TrackerPermission = "owner" | "admin" | "write" | "read";
type CategoryType = "expense" | "income" | "transfer";
type Direction = "expense" | "income";
type Frequency = "monthly" | "yearly" | "custom_days";

type SeedUserConfig = {
  name: string;
  email: string;
  password?: string;
  role?: "user" | "admin" | "superadmin";
};

type SeedCategoryConfig = {
  name: string;
  type: CategoryType;
  color: string;
};

type SeedScheduleConfig = {
  name: string;
  categoryName: string;
  payeeName: string;
  direction: Direction;
  amountCents: number;
  frequency: Frequency;
  intervalValue: number;
  notesTemplate: string;
  createdByEmail: string;
  /** Offset in days from "today" for the schedule's current due date. Negative = overdue, 0 = due, positive = upcoming. */
  dueInDays: number;
  /** How many past occurrences to backfill as completed schedule-sourced transactions. */
  historyOccurrences: number;
};

type OrganicPattern = {
  categoryName: string;
  payeeNames: string[];
  direction: Direction;
  minCents: number;
  maxCents: number;
  notes: string[];
  createdByEmails: string[];
  perMonth: number;
  monthInterval?: number;
  monthOffset?: number;
  dayRange?: [number, number];
};

type FixedTransactionConfig = {
  dayOffsetFromToday: number;
  categoryName: string;
  payeeName: string;
  direction: Direction;
  amountCents: number;
  notes: string;
  createdByEmail: string;
};

type GeneratedTransaction = {
  date: string;
  amountCents: number;
  direction: Direction;
  categoryName: string;
  payeeName: string;
  notes: string;
  createdByEmail: string;
  source?: "manual" | "schedule";
  scheduleId?: string | null;
};

type SeedTrackerConfig = {
  name: string;
  description: string;
  color: string;
  currency: string;
  sortOrder: number;
  defaultAccountName: string;
  isActive?: boolean;
  isHidden?: boolean;
  isPublic?: boolean;
  discordWebhookUrl?: string;
  discordPingRoleId?: string;
  discordDebugEnabled?: boolean;
  memberships: Array<{ userEmail: string; permission: TrackerPermission }>;
  categories: SeedCategoryConfig[];
  payees: string[];
  schedules: SeedScheduleConfig[];
  organicPatterns: OrganicPattern[];
  historyMonthsBack?: number;
  fixedTransactions?: FixedTransactionConfig[];
};

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function mulberry32(seed: number) {
  let state = seed;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, items: T[]) {
  return items[randomInt(rng, 0, items.length - 1)];
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateAt(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));
}

function addDaysToDate(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonthsBack(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() - months, 1);
}

function eachMonthInRange(start: Date, end: Date) {
  const months: Array<{ year: number; monthIndex: number }> = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (cursor.getTime() <= last.getTime()) {
    months.push({ year: cursor.getFullYear(), monthIndex: cursor.getMonth() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

function generateOrganicTransactions(
  rng: () => number,
  months: Array<{ year: number; monthIndex: number }>,
  pattern: OrganicPattern,
  today: Date
): GeneratedTransaction[] {
  const rows: GeneratedTransaction[] = [];
  const interval = pattern.monthInterval ?? 1;
  const offset = pattern.monthOffset ?? 0;
  const [minDay, maxDay] = pattern.dayRange ?? [1, 27];

  months.forEach((month, index) => {
    if ((index + offset) % interval !== 0) {
      return;
    }

    for (let i = 0; i < pattern.perMonth; i++) {
      const day = randomInt(rng, minDay, maxDay);
      const date = dateAt(month.year, month.monthIndex, day);
      if (date.getTime() > today.getTime()) {
        continue;
      }

      rows.push({
        date: toDateInputValue(date),
        amountCents: randomInt(rng, pattern.minCents, pattern.maxCents),
        direction: pattern.direction,
        categoryName: pattern.categoryName,
        payeeName: pick(rng, pattern.payeeNames),
        notes: `${SEED_TAG} ${pick(rng, pattern.notes)}`,
        createdByEmail: pick(rng, pattern.createdByEmails),
      });
    }
  });

  return rows;
}

function buildFixedTransactions(
  configs: FixedTransactionConfig[],
  today: Date
): GeneratedTransaction[] {
  return configs.map((config) => ({
    date: toDateInputValue(addDaysToDate(today, config.dayOffsetFromToday)),
    amountCents: config.amountCents,
    direction: config.direction,
    categoryName: config.categoryName,
    payeeName: config.payeeName,
    notes: `${SEED_TAG} ${config.notes}`,
    createdByEmail: config.createdByEmail,
  }));
}

/**
 * Backfills completed occurrences by walking backwards from the schedule's current
 * due date, so seeded schedules look like they have real booking history instead
 * of starting from nothing.
 */
function generateScheduleHistory(config: SeedScheduleConfig, nextDueDate: string) {
  const dates: string[] = [];
  let cursor = nextDueDate;
  for (let i = 0; i < config.historyOccurrences; i++) {
    cursor = addInterval(cursor, config.frequency, -config.intervalValue);
    dates.unshift(cursor);
  }

  const lastCompletedDate = dates.length ? dates[dates.length - 1] : null;
  const rows: GeneratedTransaction[] = dates.map((date) => ({
    date,
    amountCents: config.amountCents,
    direction: config.direction,
    categoryName: config.categoryName,
    payeeName: config.payeeName,
    notes: `${SEED_TAG} ${config.notesTemplate}`,
    createdByEmail: config.createdByEmail,
    source: "schedule",
  }));

  return { rows, lastCompletedDate };
}

const seedUsers: SeedUserConfig[] = [
  {
    name: "Sarah Mitchell",
    email: "sarah@bettertracker.demo",
    password: DEFAULT_PASSWORD,
    role: "superadmin",
  },
  {
    name: "James Carter",
    email: "james@bettertracker.demo",
    password: DEFAULT_PASSWORD,
    role: "admin",
  },
  {
    name: "Olivia Bennett",
    email: "olivia@bettertracker.demo",
    password: DEFAULT_PASSWORD,
    role: "user",
  },
  {
    name: "Noah Wright",
    email: "noah@bettertracker.demo",
    password: DEFAULT_PASSWORD,
    role: "user",
  },
  {
    name: "Emma Davis",
    email: "emma@bettertracker.demo",
    password: DEFAULT_PASSWORD,
    role: "user",
  },
];

const seedTrackers: SeedTrackerConfig[] = [
  {
    name: "Personal Finances",
    description: "Everyday income and spending for a single household budget.",
    color: "#0f766e",
    currency: "EUR",
    sortOrder: 0,
    defaultAccountName: "Everyday Checking",
    memberships: [{ userEmail: "sarah@bettertracker.demo", permission: "owner" }],
    categories: [
      { name: "Salary", type: "income", color: "#059669" },
      { name: "Freelance Income", type: "income", color: "#10b981" },
      { name: "Groceries", type: "expense", color: "#dc2626" },
      { name: "Rent", type: "expense", color: "#2563eb" },
      { name: "Dining Out", type: "expense", color: "#f97316" },
      { name: "Transport", type: "expense", color: "#7c3aed" },
      { name: "Entertainment", type: "expense", color: "#db2777" },
      { name: "Utilities", type: "expense", color: "#475569" },
      { name: "Health & Fitness", type: "expense", color: "#0ea5e9" },
      { name: "Shopping", type: "expense", color: "#eab308" },
      { name: "Travel", type: "expense", color: "#14b8a6" },
      { name: "Savings Transfer", type: "transfer", color: "#64748b" },
    ],
    payees: [
      "Northwind Technologies",
      "City Grocers",
      "Fresh Market Co",
      "Skyline Apartments",
      "The Copper Kettle",
      "Sushi Bar Nori",
      "Metro Transit",
      "CineStar",
      "Netflix",
      "Green Valley Gym",
      "PowerGrid Utilities",
      "Amazon",
      "Delta Airlines",
      "Seaside Hotel & Resort",
      "Riverside Studio (Client)",
      "Personal Savings",
      "Allstate Auto Insurance",
    ],
    schedules: [
      {
        name: "Monthly Salary",
        categoryName: "Salary",
        payeeName: "Northwind Technologies",
        direction: "income",
        amountCents: 420000,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Monthly salary payment",
        createdByEmail: "sarah@bettertracker.demo",
        dueInDays: 5,
        historyOccurrences: 11,
      },
      {
        name: "Rent Payment",
        categoryName: "Rent",
        payeeName: "Skyline Apartments",
        direction: "expense",
        amountCents: 135000,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Monthly rent",
        createdByEmail: "sarah@bettertracker.demo",
        dueInDays: -2,
        historyOccurrences: 11,
      },
      {
        name: "Streaming Subscription",
        categoryName: "Entertainment",
        payeeName: "Netflix",
        direction: "expense",
        amountCents: 1599,
        frequency: "custom_days",
        intervalValue: 30,
        notesTemplate: "Netflix subscription",
        createdByEmail: "sarah@bettertracker.demo",
        dueInDays: 9,
        historyOccurrences: 10,
      },
      {
        name: "Gym Membership",
        categoryName: "Health & Fitness",
        payeeName: "Green Valley Gym",
        direction: "expense",
        amountCents: 3990,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Gym membership",
        createdByEmail: "sarah@bettertracker.demo",
        dueInDays: 0,
        historyOccurrences: 11,
      },
      {
        name: "Car Insurance",
        categoryName: "Transport",
        payeeName: "Allstate Auto Insurance",
        direction: "expense",
        amountCents: 62000,
        frequency: "yearly",
        intervalValue: 1,
        notesTemplate: "Annual car insurance premium",
        createdByEmail: "sarah@bettertracker.demo",
        dueInDays: 150,
        historyOccurrences: 1,
      },
    ],
    organicPatterns: [
      {
        categoryName: "Groceries",
        payeeNames: ["City Grocers", "Fresh Market Co"],
        direction: "expense",
        minCents: 2500,
        maxCents: 9500,
        notes: ["Weekly grocery run", "Grocery shopping", "Pantry restock"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 4,
      },
      {
        categoryName: "Dining Out",
        payeeNames: ["The Copper Kettle", "Sushi Bar Nori"],
        direction: "expense",
        minCents: 1400,
        maxCents: 6500,
        notes: ["Dinner out", "Lunch with friends", "Weekend brunch"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 3,
      },
      {
        categoryName: "Transport",
        payeeNames: ["Metro Transit"],
        direction: "expense",
        minCents: 1500,
        maxCents: 8000,
        notes: ["Monthly transit pass top-up", "Ride share"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 2,
      },
      {
        categoryName: "Entertainment",
        payeeNames: ["CineStar"],
        direction: "expense",
        minCents: 900,
        maxCents: 3500,
        notes: ["Movie night", "Concert ticket"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Utilities",
        payeeNames: ["PowerGrid Utilities"],
        direction: "expense",
        minCents: 6000,
        maxCents: 14000,
        notes: ["Electricity & water bill"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Shopping",
        payeeNames: ["Amazon"],
        direction: "expense",
        minCents: 3500,
        maxCents: 22000,
        notes: ["Online order", "New gadget"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 2,
      },
      {
        categoryName: "Travel",
        payeeNames: ["Delta Airlines", "Seaside Hotel & Resort"],
        direction: "expense",
        minCents: 28000,
        maxCents: 95000,
        notes: ["Weekend getaway", "Flight booking"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 4,
        monthOffset: 1,
      },
      {
        categoryName: "Freelance Income",
        payeeNames: ["Riverside Studio (Client)"],
        direction: "income",
        minCents: 50000,
        maxCents: 150000,
        notes: ["Freelance project payout"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 3,
        monthOffset: 2,
      },
      {
        categoryName: "Savings Transfer",
        payeeNames: ["Personal Savings"],
        direction: "expense",
        minCents: 30000,
        maxCents: 30000,
        notes: ["Monthly savings transfer"],
        createdByEmails: ["sarah@bettertracker.demo"],
        perMonth: 1,
      },
    ],
    historyMonthsBack: 20,
  },
  {
    name: "Shared Apartment",
    description: "Household bills and shared costs split between roommates.",
    color: "#2563eb",
    currency: "EUR",
    sortOrder: 1,
    defaultAccountName: "Household Account",
    memberships: [
      { userEmail: "james@bettertracker.demo", permission: "owner" },
      { userEmail: "olivia@bettertracker.demo", permission: "admin" },
      { userEmail: "noah@bettertracker.demo", permission: "write" },
      { userEmail: "emma@bettertracker.demo", permission: "read" },
    ],
    categories: [
      { name: "Rent", type: "expense", color: "#2563eb" },
      { name: "Utilities", type: "expense", color: "#0ea5e9" },
      { name: "Groceries", type: "expense", color: "#f97316" },
      { name: "Internet", type: "expense", color: "#475569" },
      { name: "Household Supplies", type: "expense", color: "#dc2626" },
      { name: "Shared Streaming", type: "expense", color: "#db2777" },
      { name: "Contributions", type: "income", color: "#16a34a" },
      { name: "Cleaning Service", type: "expense", color: "#7c3aed" },
    ],
    payees: [
      "Lakeside Apartments",
      "PowerGrid Utilities",
      "FreshMart",
      "Provider Fiber Co",
      "Home Essentials Co",
      "Netflix",
      "Roommate Contribution",
      "Sparkle Cleaning Services",
    ],
    schedules: [
      {
        name: "Apartment Rent",
        categoryName: "Rent",
        payeeName: "Lakeside Apartments",
        direction: "expense",
        amountCents: 168000,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Shared monthly rent",
        createdByEmail: "james@bettertracker.demo",
        dueInDays: -1,
        historyOccurrences: 11,
      },
      {
        name: "Internet & WiFi",
        categoryName: "Internet",
        payeeName: "Provider Fiber Co",
        direction: "expense",
        amountCents: 4999,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Fiber internet subscription",
        createdByEmail: "james@bettertracker.demo",
        dueInDays: 0,
        historyOccurrences: 11,
      },
      {
        name: "Cleaning Service",
        categoryName: "Cleaning Service",
        payeeName: "Sparkle Cleaning Services",
        direction: "expense",
        amountCents: 8000,
        frequency: "custom_days",
        intervalValue: 14,
        notesTemplate: "Biweekly apartment cleaning",
        createdByEmail: "olivia@bettertracker.demo",
        dueInDays: 4,
        historyOccurrences: 20,
      },
      {
        name: "Shared Streaming",
        categoryName: "Shared Streaming",
        payeeName: "Netflix",
        direction: "expense",
        amountCents: 1799,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Shared Netflix subscription",
        createdByEmail: "noah@bettertracker.demo",
        dueInDays: 12,
        historyOccurrences: 10,
      },
    ],
    organicPatterns: [
      {
        categoryName: "Groceries",
        payeeNames: ["FreshMart"],
        direction: "expense",
        minCents: 3000,
        maxCents: 9000,
        notes: ["Shared grocery run", "Household grocery shopping"],
        createdByEmails: [
          "james@bettertracker.demo",
          "olivia@bettertracker.demo",
          "noah@bettertracker.demo",
        ],
        perMonth: 3,
      },
      {
        categoryName: "Utilities",
        payeeNames: ["PowerGrid Utilities"],
        direction: "expense",
        minCents: 7000,
        maxCents: 15000,
        notes: ["Electricity & water bill"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Household Supplies",
        payeeNames: ["Home Essentials Co"],
        direction: "expense",
        minCents: 1500,
        maxCents: 6000,
        notes: ["Cleaning supplies", "Kitchen and bathroom restock"],
        createdByEmails: ["olivia@bettertracker.demo", "noah@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Contributions",
        payeeNames: ["Roommate Contribution"],
        direction: "income",
        minCents: 35000,
        maxCents: 35000,
        notes: ["Monthly roommate contribution"],
        createdByEmails: ["james@bettertracker.demo", "olivia@bettertracker.demo"],
        perMonth: 3,
      },
    ],
    historyMonthsBack: 18,
  },
  {
    name: "Community Fundraiser",
    description: "Public fundraising campaign for the neighborhood community center.",
    color: "#f97316",
    currency: "EUR",
    sortOrder: 2,
    defaultAccountName: "Fundraiser Fund",
    isPublic: true,
    isHidden: false,
    memberships: [
      { userEmail: "olivia@bettertracker.demo", permission: "owner" },
      { userEmail: "james@bettertracker.demo", permission: "write" },
    ],
    categories: [
      { name: "Donations", type: "income", color: "#16a34a" },
      { name: "Venue & Events", type: "expense", color: "#2563eb" },
      { name: "Supplies", type: "expense", color: "#dc2626" },
      { name: "Marketing", type: "expense", color: "#7c3aed" },
      { name: "Refreshments", type: "expense", color: "#f97316" },
      { name: "Volunteer Reimbursement", type: "expense", color: "#64748b" },
    ],
    payees: [
      "Community Donors",
      "Grand Hall Venue",
      "Citywide Storage",
      "Craft Supplies Co",
      "Local Print Shop",
      "Riverside Catering",
      "Volunteer Fund",
    ],
    schedules: [
      {
        name: "Storage Unit Rental",
        categoryName: "Venue & Events",
        payeeName: "Citywide Storage",
        direction: "expense",
        amountCents: 6000,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Storage unit for event supplies",
        createdByEmail: "olivia@bettertracker.demo",
        dueInDays: -3,
        historyOccurrences: 9,
      },
      {
        name: "Annual Venue Deposit",
        categoryName: "Venue & Events",
        payeeName: "Grand Hall Venue",
        direction: "expense",
        amountCents: 50000,
        frequency: "yearly",
        intervalValue: 1,
        notesTemplate: "Deposit for annual gala venue booking",
        createdByEmail: "olivia@bettertracker.demo",
        dueInDays: 200,
        historyOccurrences: 1,
      },
    ],
    organicPatterns: [
      {
        categoryName: "Donations",
        payeeNames: ["Community Donors"],
        direction: "income",
        minCents: 1000,
        maxCents: 25000,
        notes: ["Individual donation", "Online fundraiser contribution", "Matching gift"],
        createdByEmails: ["olivia@bettertracker.demo", "james@bettertracker.demo"],
        perMonth: 5,
      },
      {
        categoryName: "Marketing",
        payeeNames: ["Local Print Shop"],
        direction: "expense",
        minCents: 5000,
        maxCents: 20000,
        notes: ["Flyers and posters", "Social media ad campaign"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 3,
      },
      {
        categoryName: "Supplies",
        payeeNames: ["Craft Supplies Co"],
        direction: "expense",
        minCents: 3000,
        maxCents: 15000,
        notes: ["Event supplies", "Decorations"],
        createdByEmails: ["olivia@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 2,
        monthOffset: 1,
      },
      {
        categoryName: "Refreshments",
        payeeNames: ["Riverside Catering"],
        direction: "expense",
        minCents: 8000,
        maxCents: 30000,
        notes: ["Catering for community event"],
        createdByEmails: ["olivia@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 3,
        monthOffset: 1,
      },
      {
        categoryName: "Volunteer Reimbursement",
        payeeNames: ["Volunteer Fund"],
        direction: "expense",
        minCents: 2000,
        maxCents: 9000,
        notes: ["Volunteer expense reimbursement"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 2,
      },
    ],
    historyMonthsBack: 14,
  },
  {
    name: "Freelance Business",
    description: "Client income and business expenses for independent consulting work.",
    color: "#7c3aed",
    currency: "USD",
    sortOrder: 3,
    defaultAccountName: "Business Checking",
    discordWebhookUrl:
      "https://discord.com/api/webhooks/123456789012345678/demo-placeholder-token-do-not-use",
    discordPingRoleId: "987654321098765432",
    discordDebugEnabled: true,
    memberships: [
      { userEmail: "james@bettertracker.demo", permission: "owner" },
      { userEmail: "sarah@bettertracker.demo", permission: "write" },
    ],
    categories: [
      { name: "Client Revenue", type: "income", color: "#059669" },
      { name: "Software & Tools", type: "expense", color: "#0ea5e9" },
      { name: "Equipment", type: "expense", color: "#475569" },
      { name: "Marketing & Ads", type: "expense", color: "#db2777" },
      { name: "Professional Services", type: "expense", color: "#dc2626" },
      { name: "Tax Reserve", type: "transfer", color: "#64748b" },
    ],
    payees: [
      "Acme Corp",
      "Bright Path Media",
      "Adobe",
      "GitHub",
      "Dell",
      "Google Ads",
      "Ledger & Co Accounting",
      "Tax Reserve Account",
      "Namecheap",
    ],
    schedules: [
      {
        name: "Software Subscriptions",
        categoryName: "Software & Tools",
        payeeName: "Adobe",
        direction: "expense",
        amountCents: 5499,
        frequency: "monthly",
        intervalValue: 1,
        notesTemplate: "Adobe Creative Cloud subscription",
        createdByEmail: "james@bettertracker.demo",
        dueInDays: 0,
        historyOccurrences: 11,
      },
      {
        name: "Quarterly Tax Reserve",
        categoryName: "Tax Reserve",
        payeeName: "Tax Reserve Account",
        direction: "expense",
        amountCents: 180000,
        frequency: "custom_days",
        intervalValue: 90,
        notesTemplate: "Quarterly estimated tax set-aside",
        createdByEmail: "james@bettertracker.demo",
        dueInDays: 20,
        historyOccurrences: 5,
      },
      {
        name: "Domain & Hosting Renewal",
        categoryName: "Software & Tools",
        payeeName: "Namecheap",
        direction: "expense",
        amountCents: 4800,
        frequency: "yearly",
        intervalValue: 1,
        notesTemplate: "Domain and hosting renewal",
        createdByEmail: "james@bettertracker.demo",
        dueInDays: 80,
        historyOccurrences: 1,
      },
    ],
    organicPatterns: [
      {
        categoryName: "Client Revenue",
        payeeNames: ["Acme Corp", "Bright Path Media"],
        direction: "income",
        minCents: 80000,
        maxCents: 250000,
        notes: ["Client invoice payment", "Project milestone payment"],
        createdByEmails: ["james@bettertracker.demo", "sarah@bettertracker.demo"],
        perMonth: 2,
      },
      {
        categoryName: "Software & Tools",
        payeeNames: ["GitHub"],
        direction: "expense",
        minCents: 700,
        maxCents: 2100,
        notes: ["GitHub Team plan"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Equipment",
        payeeNames: ["Dell"],
        direction: "expense",
        minCents: 15000,
        maxCents: 60000,
        notes: ["New equipment purchase"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 5,
      },
      {
        categoryName: "Marketing & Ads",
        payeeNames: ["Google Ads"],
        direction: "expense",
        minCents: 5000,
        maxCents: 20000,
        notes: ["Ad campaign spend"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
      },
      {
        categoryName: "Professional Services",
        payeeNames: ["Ledger & Co Accounting"],
        direction: "expense",
        minCents: 20000,
        maxCents: 50000,
        notes: ["Bookkeeping and accounting services"],
        createdByEmails: ["james@bettertracker.demo"],
        perMonth: 1,
        monthInterval: 4,
        monthOffset: 2,
      },
    ],
    historyMonthsBack: 16,
  },
  {
    name: "Road Trip 2023",
    description: "Archive of a two-week coastal road trip.",
    color: "#14b8a6",
    currency: "EUR",
    sortOrder: 4,
    defaultAccountName: "Travel Card",
    isActive: false,
    isHidden: true,
    memberships: [{ userEmail: "sarah@bettertracker.demo", permission: "owner" }],
    categories: [
      { name: "Fuel", type: "expense", color: "#f97316" },
      { name: "Lodging", type: "expense", color: "#2563eb" },
      { name: "Food", type: "expense", color: "#dc2626" },
      { name: "Activities", type: "expense", color: "#7c3aed" },
    ],
    payees: ["Highway Fuel Stop", "Seaside Motel", "Local Diner", "Adventure Tours Co"],
    schedules: [],
    organicPatterns: [],
    fixedTransactions: [
      { dayOffsetFromToday: -440, categoryName: "Fuel", payeeName: "Highway Fuel Stop", direction: "expense", amountCents: 6200, notes: "Fuel for the drive down", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -440, categoryName: "Lodging", payeeName: "Seaside Motel", direction: "expense", amountCents: 8900, notes: "First night motel", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -439, categoryName: "Food", payeeName: "Local Diner", direction: "expense", amountCents: 2400, notes: "Breakfast on the coast", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -439, categoryName: "Activities", payeeName: "Adventure Tours Co", direction: "expense", amountCents: 9500, notes: "Coastal boat tour", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -437, categoryName: "Lodging", payeeName: "Seaside Motel", direction: "expense", amountCents: 8900, notes: "Second stop motel", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -437, categoryName: "Fuel", payeeName: "Highway Fuel Stop", direction: "expense", amountCents: 5800, notes: "Fuel top-up", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -436, categoryName: "Food", payeeName: "Local Diner", direction: "expense", amountCents: 3100, notes: "Dinner by the pier", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -434, categoryName: "Activities", payeeName: "Adventure Tours Co", direction: "expense", amountCents: 14000, notes: "Guided hiking trip", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -433, categoryName: "Lodging", payeeName: "Seaside Motel", direction: "expense", amountCents: 9800, notes: "Third stop motel", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -432, categoryName: "Fuel", payeeName: "Highway Fuel Stop", direction: "expense", amountCents: 6100, notes: "Fuel top-up", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -431, categoryName: "Food", payeeName: "Local Diner", direction: "expense", amountCents: 2900, notes: "Farewell dinner", createdByEmail: "sarah@bettertracker.demo" },
      { dayOffsetFromToday: -429, categoryName: "Fuel", payeeName: "Highway Fuel Stop", direction: "expense", amountCents: 5900, notes: "Fuel for the drive home", createdByEmail: "sarah@bettertracker.demo" },
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
      discordWebhookUrl: config.discordWebhookUrl ?? "",
      discordPingRoleId: config.discordPingRoleId ?? "",
      discordDebugEnabled: config.discordDebugEnabled ?? false,
      isActive: config.isActive ?? true,
      isHidden: config.isHidden ?? false,
      isPublic: config.isPublic ?? false,
      sortOrder: config.sortOrder,
    })
    .returning();

  return created;
}

async function ensureTrackerMembership(
  trackerId: string,
  userId: string,
  permission: TrackerPermission
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

async function ensureCategory(trackerId: string, definition: SeedCategoryConfig) {
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

async function ensureSchedule(
  trackerId: string,
  config: SeedScheduleConfig,
  categoryId: string,
  payeeId: string,
  createdByUserId: string,
  today: Date
): Promise<GeneratedTransaction[]> {
  const [existing] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.trackerId, trackerId), eq(schedules.name, config.name)))
    .limit(1);

  if (existing) {
    return [];
  }

  const nextDueDate = toDateInputValue(addDaysToDate(today, config.dueInDays));
  const { rows, lastCompletedDate } = generateScheduleHistory(config, nextDueDate);

  const [created] = await db
    .insert(schedules)
    .values({
      trackerId,
      name: config.name,
      amountCents: config.amountCents,
      direction: config.direction,
      categoryId,
      payeeId,
      notesTemplate: config.notesTemplate,
      frequency: config.frequency,
      intervalValue: config.intervalValue,
      nextDueDate,
      lastCompletedDate,
      isActive: true,
      autoCreateDisabled: true,
      createdByUserId,
    })
    .returning();

  return rows.map((row) => ({ ...row, scheduleId: created.id }));
}

async function seedTrackerTransactions(
  trackerId: string,
  defaultAccountName: string,
  definitions: GeneratedTransaction[],
  categoryByName: Map<string, string>,
  payeeByName: Map<string, string>,
  userByEmail: Map<string, string>
) {
  if (definitions.length === 0) {
    return 0;
  }

  const [existingSeedRow] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.trackerId, trackerId), like(transactions.notes, `%${SEED_TAG}%`)))
    .limit(1);

  if (existingSeedRow) {
    return 0;
  }

  const rows = definitions.map((entry) => {
    const createdByUserId = userByEmail.get(entry.createdByEmail);
    const categoryId = categoryByName.get(entry.categoryName);
    const payeeId = payeeByName.get(entry.payeeName);

    if (!createdByUserId) {
      throw new Error(`Missing seeded user for ${entry.createdByEmail}`);
    }
    if (!categoryId) {
      throw new Error(`Missing category ${entry.categoryName} for tracker ${trackerId}`);
    }
    if (!payeeId) {
      throw new Error(`Missing payee ${entry.payeeName} for tracker ${trackerId}`);
    }

    return {
      trackerId,
      accountName: defaultAccountName,
      date: entry.date,
      amountCents: entry.amountCents,
      direction: entry.direction,
      categoryId,
      payeeId,
      customPayeeName: null,
      notes: entry.notes,
      source: entry.source ?? ("manual" as const),
      scheduleId: entry.scheduleId ?? null,
      createdByUserId,
    };
  });

  for (let i = 0; i < rows.length; i += TRANSACTION_BATCH_SIZE) {
    await db.insert(transactions).values(rows.slice(i, i + TRANSACTION_BATCH_SIZE));
  }

  return rows.length;
}

async function processTracker(
  config: SeedTrackerConfig,
  createdUsers: Map<string, string>,
  today: Date
) {
  const tracker = await ensureTracker(config);

  for (const membership of config.memberships) {
    const userId = createdUsers.get(membership.userEmail);
    if (!userId) {
      throw new Error(`Missing seeded membership user ${membership.userEmail}`);
    }
    await ensureTrackerMembership(tracker.id, userId, membership.permission);
  }

  const categoryByName = new Map<string, string>();
  for (const category of config.categories) {
    const saved = await ensureCategory(tracker.id, category);
    categoryByName.set(saved.name, saved.id);
  }

  const payeeByName = new Map<string, string>();
  for (const payeeName of config.payees) {
    const saved = await ensurePayee(tracker.id, payeeName);
    payeeByName.set(saved.name, saved.id);
  }

  const scheduleRows: GeneratedTransaction[] = [];
  for (const scheduleConfig of config.schedules) {
    const categoryId = categoryByName.get(scheduleConfig.categoryName);
    const payeeId = payeeByName.get(scheduleConfig.payeeName);
    const createdByUserId = createdUsers.get(scheduleConfig.createdByEmail);

    if (!categoryId || !payeeId || !createdByUserId) {
      throw new Error(`Missing reference for schedule "${scheduleConfig.name}" in ${config.name}`);
    }

    const rows = await ensureSchedule(
      tracker.id,
      scheduleConfig,
      categoryId,
      payeeId,
      createdByUserId,
      today
    );
    scheduleRows.push(...rows);
  }

  const rng = mulberry32(hashSeed(config.name));
  const months = eachMonthInRange(addMonthsBack(today, config.historyMonthsBack ?? 12), today);
  const organicRows = config.organicPatterns.flatMap((pattern) =>
    generateOrganicTransactions(rng, months, pattern, today)
  );
  const fixedRows = config.fixedTransactions
    ? buildFixedTransactions(config.fixedTransactions, today)
    : [];

  const allRows = [...scheduleRows, ...organicRows, ...fixedRows].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return seedTrackerTransactions(
    tracker.id,
    config.defaultAccountName,
    allRows,
    categoryByName,
    payeeByName,
    createdUsers
  );
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await ensureRegistrationEnabled();

  const createdUsers = new Map<string, string>();
  for (const config of seedUsers) {
    const seededUser = await ensureUser(config);
    createdUsers.set(config.email, seededUser.id);
  }

  const primaryUserId = createdUsers.get("sarah@bettertracker.demo");
  if (!primaryUserId) {
    throw new Error("Missing seeded primary user");
  }

  await ensureBootstrapForUser(primaryUserId);

  let insertedTransactions = 0;
  for (const trackerConfig of seedTrackers) {
    insertedTransactions += await processTracker(trackerConfig, createdUsers, today);
  }

  console.log("Seed complete.");
  console.log(`Users available: ${seedUsers.map((entry) => entry.email).join(", ")}`);
  console.log(`Login for primary user: sarah@bettertracker.demo / ${DEFAULT_PASSWORD}`);
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
