import { and, desc, eq, gte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogIn,
} from "lucide-react";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { StatTile } from "@/components/ui/stat-tile";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityIcon } from "@/components/ui/entity-icon";
import { ListRow } from "@/components/ui/list-row";
import { SectionCard } from "@/components/ui/section-card";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function formatDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(dateStr),
  );
}

function formatMonth(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr + "-01"));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("PublicShare");
  const rows = await db
    .select({ name: trackers.name, description: trackers.description })
    .from(trackers)
    .where(
      and(
        eq(trackers.slug, slug),
        eq(trackers.isPublic, true),
        eq(trackers.isHidden, false),
      ),
    )
    .limit(1);
  const tracker = rows[0];
  if (!tracker) return { title: t("metadata.notFoundTitle") };
  return {
    title: tracker.name,
    description: tracker.description ?? undefined,
  };
}

export default async function PublicTrackerPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("PublicShare");

  const [session, trackerRows] = await Promise.all([
    getServerSession(),
    db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.slug, slug),
          eq(trackers.isPublic, true),
          eq(trackers.isHidden, false),
        ),
      )
      .limit(1),
  ]);

  const tracker = trackerRows[0];
  if (!tracker) notFound();

  const isLoggedIn = !!session?.user;

  // Fetch all transactions + totals + monthly breakdown in parallel
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [items, totalsRows, monthlyRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amountCents: transactions.amountCents,
        direction: transactions.direction,
        categoryName: categories.name,
        payeeName: payees.name,
        customPayeeName: transactions.customPayeeName,
        notes: transactions.notes,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(payees, eq(payees.id, transactions.payeeId))
      .where(eq(transactions.trackerId, tracker.id))
      .orderBy(desc(transactions.date), desc(transactions.createdAt)),

    db
      .select({
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.trackerId, tracker.id)),

    db
      .select({
        month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.trackerId, tracker.id),
          gte(transactions.date, sixMonthsAgoStr),
        ),
      )
      .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
      .orderBy(sql`strftime('%Y-%m', ${transactions.date}) desc`)
      .limit(6),
  ]);

  const totals = totalsRows[0] ?? { incomeCents: 0, expenseCents: 0 };
  const balanceCents = totals.incomeCents - totals.expenseCents;
  const recentItems = items.slice(0, 20);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href={isLoggedIn ? "/" : "/login"}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-semibold tracking-tight">
                BetterTracker
              </span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2">
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-sm"
                style={{ backgroundColor: tracker.color }}
              />
              <span className="max-w-32 truncate text-sm font-medium sm:max-w-none">
                {tracker.name}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-pill border border-border bg-card px-2.5 py-0.5 font-subtext text-xs text-muted-foreground sm:inline-flex">
              {t("header.publicView")}
            </span>
            {isLoggedIn ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                {t("header.dashboard")}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                <LogIn className="h-3.5 w-3.5" />
                {t("header.login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {tracker.description ? (
          <p className="font-subtext text-sm text-muted-foreground">
            {tracker.description}
          </p>
        ) : null}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={t("stats.balance")}
            tone="inverse"
            icon={Landmark}
            value={
              <Amount
                cents={balanceCents}
                currency={tracker.currency}
                size="lg"
                tone="none"
              />
            }
            className="col-span-2 sm:col-span-1"
          />
          <StatTile
            label={t("stats.income")}
            icon={ArrowUpRight}
            value={
              <Amount
                cents={totals.incomeCents}
                currency={tracker.currency}
                size="lg"
                className="text-income"
              />
            }
          />
          <StatTile
            label={t("stats.expenses")}
            icon={ArrowDownLeft}
            value={
              <Amount
                cents={totals.expenseCents}
                currency={tracker.currency}
                size="lg"
                className="text-expense"
              />
            }
          />
        </div>

        {/* Monthly breakdown (last 6 months) */}
        {monthlyRows.length > 0 && (
          <SectionCard title={t("monthly.title")}>
            <div className="divide-y divide-border">
              {monthlyRows.map((row) => {
                const net = row.incomeCents - row.expenseCents;
                return (
                  <div
                    key={row.month}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <span className="text-sm font-medium">
                      {formatMonth(row.month, locale)}
                    </span>
                    <div className="flex items-center gap-4">
                      <Amount
                        cents={row.incomeCents}
                        currency={tracker.currency}
                        direction="income"
                        signed
                        size="xs"
                        className="hidden sm:inline-flex"
                      />
                      <Amount
                        cents={row.expenseCents}
                        currency={tracker.currency}
                        direction="expense"
                        size="xs"
                        className="hidden sm:inline-flex"
                      />
                      <Amount
                        cents={net}
                        currency={tracker.currency}
                        size="sm"
                        className={net >= 0 ? "text-income" : "text-expense"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Transaction list */}
        <SectionCard
          title={t("transactions.title")}
          titleRight={
            <span className="rounded-pill border border-border bg-card px-2.5 py-0.5 font-subtext text-xs font-medium text-muted-foreground">
              {t("transactions.total", { count: items.length })}
            </span>
          }
          noPadding
        >
          {items.length === 0 ? (
            <EmptyState
              title={t("transactions.emptyTitle")}
              description={t("transactions.emptyDescription")}
              className="py-10"
            />
          ) : (
            <div className="space-y-1.5 px-4">
              {recentItems.map((item) => (
                <ListRow
                  key={item.id}
                  leading={
                    <EntityIcon
                      icon={
                        item.direction === "expense"
                          ? ArrowDownLeft
                          : ArrowUpRight
                      }
                      size="sm"
                      className={
                        item.direction === "expense"
                          ? "bg-expense-muted text-expense"
                          : "bg-income-muted text-income"
                      }
                    />
                  }
                  title={
                    item.payeeName ??
                    item.customPayeeName ??
                    t("transactions.anonymousPayee")
                  }
                  subtitle={[
                    item.categoryName ?? t("transactions.noCategory"),
                    item.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  meta={
                    <span className="font-subtext text-xs text-muted-foreground">
                      {formatDate(item.date, locale)}
                    </span>
                  }
                  trailing={
                    <Amount
                      cents={item.amountCents}
                      currency={tracker.currency}
                      direction={item.direction}
                      signed
                      size="sm"
                    />
                  }
                />
              ))}
              {items.length > recentItems.length ? (
                <p className="py-3 text-center font-subtext text-xs text-muted-foreground">
                  {t("transactions.showingRecent", {
                    recentCount: recentItems.length,
                    totalCount: items.length,
                  })}
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
