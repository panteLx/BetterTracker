import { and, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Landmark } from "lucide-react";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { formatCurrency } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
    new Date(dateStr)
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

  const trackerRows = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.slug, slug), eq(trackers.isPublic, true), eq(trackers.isHidden, false)))
    .limit(1);

  const tracker = trackerRows[0];
  if (!tracker) notFound();

  const items = await db
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
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  const totalsRows = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      expenseCents: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.trackerId, tracker.id));

  const totals = totalsRows[0] ?? { incomeCents: 0, expenseCents: 0 };
  const balanceCents = totals.incomeCents - totals.expenseCents;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">BetterTracker</span>
            </Link>
            <span className="text-border-strong">/</span>
            <div className="flex items-center gap-2">
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-sm"
                style={{ backgroundColor: tracker.color }}
              />
              <span className="text-sm font-medium truncate max-w-32 sm:max-w-none">{tracker.name}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
              Öffentliche Ansicht
            </span>
            <Link
              href="/login"
              className="rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              Anmelden
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Tracker info */}
        {tracker.description ? (
          <p className="mb-4 text-sm text-muted-foreground">{tracker.description}</p>
        ) : null}

        {/* Summary cards */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
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

        {/* Transaction list */}
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">
              Buchungen{" "}
              <span className="ml-1 font-normal text-muted-foreground">
                ({items.length})
              </span>
            </p>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Keine Buchungen vorhanden"
              description="Noch keine Buchungen für diesen Tracker."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((item) => {
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
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
