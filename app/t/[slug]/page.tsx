import { and, desc, eq, gte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Landmark, LayoutDashboard, LogIn } from "lucide-react";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { formatCurrency } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(dateStr));
}

function formatMonth(dateStr: string) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(dateStr + "-01"),
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const rows = await db
    .select({ name: trackers.name, description: trackers.description })
    .from(trackers)
    .where(and(eq(trackers.slug, slug), eq(trackers.isPublic, true), eq(trackers.isHidden, false)))
    .limit(1);
  const tracker = rows[0];
  if (!tracker) return { title: "Tracker nicht gefunden" };
  return {
    title: tracker.name,
    description: tracker.description ?? undefined,
  };
}

export default async function PublicTrackerPage({ params }: Props) {
  const { slug } = await params;

  const [session, trackerRows] = await Promise.all([
    getServerSession(),
    db
      .select()
      .from(trackers)
      .where(and(eq(trackers.slug, slug), eq(trackers.isPublic, true), eq(trackers.isHidden, false)))
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
      .where(and(eq(transactions.trackerId, tracker.id), gte(transactions.date, sixMonthsAgoStr)))
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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href={isLoggedIn ? "/" : "/login"} className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">BetterTracker</span>
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
            <span className="hidden rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-flex">
              Öffentliche Ansicht
            </span>
            {isLoggedIn ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                <LogIn className="h-3.5 w-3.5" />
                Anmelden
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {tracker.description ? (
          <p className="text-sm text-muted-foreground">{tracker.description}</p>
        ) : null}

        {/* Summary tiles */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Einnahmen"
            value={`+${formatCurrency(totals.incomeCents, tracker.currency)}`}
            icon={ArrowUpRight}
            tone="income"
          />
          <StatTile
            label="Ausgaben"
            value={`-${formatCurrency(totals.expenseCents, tracker.currency)}`}
            icon={ArrowDownLeft}
            tone="expense"
          />
          <StatTile
            label="Saldo"
            value={`${balanceCents >= 0 ? "+" : ""}${formatCurrency(balanceCents, tracker.currency)}`}
            icon={Landmark}
            tone={balanceCents >= 0 ? "primary" : "expense"}
          />
        </div>

        {/* Monthly breakdown (last 6 months) */}
        {monthlyRows.length > 0 && (
          <SectionCard title="Monatliche Übersicht">
            <div className="divide-y divide-border/40">
              {monthlyRows.map((row) => {
                const net = row.incomeCents - row.expenseCents;
                return (
                  <div
                    key={row.month}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <span className="text-sm font-medium">{formatMonth(row.month)}</span>
                    <div className="flex items-center gap-4 text-sm tabular-nums">
                      <span className="hidden text-income sm:inline">
                        +{formatCurrency(row.incomeCents, tracker.currency)}
                      </span>
                      <span className="hidden text-expense sm:inline">
                        -{formatCurrency(row.expenseCents, tracker.currency)}
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          net >= 0 ? "text-income" : "text-expense",
                        )}
                      >
                        {net >= 0 ? "+" : ""}
                        {formatCurrency(net, tracker.currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Transaction list */}
        <SectionCard
          title="Buchungen"
          titleRight={
            <span className="rounded-full border border-border/60 bg-background/75 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {items.length} gesamt
            </span>
          }
          noPadding
        >
          {items.length === 0 ? (
            <EmptyState
              title="Keine Buchungen vorhanden"
              description="Noch keine Buchungen für diesen Tracker."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-border/40">
              {recentItems.map((item) => {
                const payeeLabel = item.payeeName ?? item.customPayeeName ?? "Anonym";
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{payeeLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.categoryName ?? "—"}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          item.direction === "income" ? "text-income" : "text-expense",
                        )}
                      >
                        {item.direction === "income" ? "+" : "-"}
                        {formatCurrency(item.amountCents, tracker.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                    </div>
                  </li>
                );
              })}
              {items.length > 20 && (
                <li className="px-4 py-3 text-center text-xs text-muted-foreground">
                  Zeige die letzten 20 von {items.length} Buchungen
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
