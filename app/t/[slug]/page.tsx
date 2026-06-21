import { and, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { categories, payees, trackers, transactions } from "@/lib/db/schema";
import { formatCurrency } from "@/lib/utils";

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
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-8 w-8 shrink-0 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: tracker.color }}
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{tracker.name}</h1>
              {tracker.description ? (
                <p className="truncate text-sm text-muted-foreground">
                  {tracker.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
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
        {/* Summary cards */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Einnahmen</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">
              +{formatCurrency(totals.incomeCents, tracker.currency)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Ausgaben</p>
            <p className="mt-1 text-xl font-semibold text-rose-600">
              -{formatCurrency(totals.expenseCents, tracker.currency)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p
              className={`mt-1 text-xl font-semibold ${balanceCents >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {balanceCents >= 0 ? "+" : ""}
              {formatCurrency(balanceCents, tracker.currency)}
            </p>
          </div>
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
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Noch keine Buchungen vorhanden.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((item) => {
                const payeeLabel =
                  item.payeeName ?? item.customPayeeName ?? "Anonym";
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {payeeLabel}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.categoryName ?? "—"}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${item.direction === "income" ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {item.direction === "income" ? "+" : "-"}
                        {formatCurrency(item.amountCents, tracker.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.date)}
                      </p>
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
