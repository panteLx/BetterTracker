"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  CalendarClock,
  CreditCard,
  Loader2,
  Moon,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  Sun,
  TimerReset,
  User,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Amount } from "@/components/ui/amount";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";
import { fetchJson } from "@/lib/client-fetch";
import { LAST_TRACKER_KEY } from "@/lib/last-tracker";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { formatDateShort } from "@/lib/utils";

const routes = [
  { href: "/", label: "Dashboard", icon: CreditCard },
  { href: "/transactions", label: "Transaktionen", icon: ReceiptText },
  { href: "/schedules", label: "Termine", icon: TimerReset },
  { href: "/statistics", label: "Statistiken", icon: BarChart2 },
  { href: "/profile", label: "Profil", icon: User },
];

type Tracker = {
  id: string;
  name: string;
  color?: string | null;
  currency: string;
  isActive: boolean;
};

type TransactionHit = {
  id: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryName?: string | null;
  payeeName?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
};

type TransactionHitWithTracker = TransactionHit & {
  trackerId: string;
  trackerName: string;
  trackerColor?: string | null;
  currency: string;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

function matchesQuery(label: string, query: string) {
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

export function CommandPalette({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickAddStep, setQuickAddStep] = useState<"buchung" | "termin" | null>(
    null,
  );
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isAdmin = role === "admin" || role === "superadmin";
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const recalledTrackerId = useLocalStorageValue(LAST_TRACKER_KEY) ?? undefined;
  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
    enabled: open,
  });
  const trackers = trackersQuery.data?.items ?? [];
  const activeTrackers = trackers.filter((t) => t.isActive);
  // Used only as the tracker to land on for the "show all" action, when no
  // hit is available to infer it from.
  const defaultTracker =
    activeTrackers.find((t) => t.id === recalledTrackerId) ?? activeTrackers[0];

  const searchReady =
    open && debouncedSearch.length >= 2 && activeTrackers.length > 0;
  // Every tracker you belong to gets its own request — the API only
  // filters by a single trackerId, and there's no cross-tracker endpoint.
  const resultsQueries = useQueries({
    queries: activeTrackers.map((tracker) => ({
      queryKey: ["command-search", tracker.id, debouncedSearch],
      queryFn: () =>
        fetchJson<{ items: TransactionHit[] }>(
          `/api/transactions?trackerId=${tracker.id}&q=${encodeURIComponent(debouncedSearch)}&page=1`,
        ),
      enabled: searchReady,
    })),
  });
  const isSearching = resultsQueries.some((q) => q.isFetching);
  const hits: TransactionHitWithTracker[] = resultsQueries
    .flatMap((result, index) => {
      const tracker = activeTrackers[index];
      return (result.data?.items ?? []).map((item) => ({
        ...item,
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        currency: tracker.currency,
      }));
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const showTrackerBadge = activeTrackers.length > 1;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function openQuickAdd(step: "buchung" | "termin") {
    setOpen(false);
    setQuickAddStep(step);
  }

  function openTransactionSearch(query: string, trackerId?: string) {
    const targetTrackerId = trackerId ?? defaultTracker?.id;
    if (!targetTrackerId) return;
    setOpen(false);
    const params = new URLSearchParams({ q: query, tracker: targetTrackerId });
    router.push(`/transactions?${params.toString()}`);
  }

  const filteredRoutes = routes.filter((r) => matchesQuery(r.label, search));

  const actions = [
    {
      key: "new-buchung",
      label: "Neue Buchung",
      icon: Receipt,
      onSelect: () => openQuickAdd("buchung"),
    },
    {
      key: "new-termin",
      label: "Neuer Termin",
      icon: CalendarClock,
      onSelect: () => openQuickAdd("termin"),
    },
    {
      key: "toggle-theme",
      label:
        resolvedTheme === "dark"
          ? "Zu hellem Modus wechseln"
          : "Zu dunklem Modus wechseln",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      onSelect: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setOpen(false);
      },
    },
  ];
  const filteredActions = actions.filter((a) => matchesQuery(a.label, search));

  const settingsItems = isAdmin
    ? [{ href: "/admin", label: "Admin-Bereich", icon: Settings }]
    : [];
  const filteredSettings = settingsItems.filter((s) =>
    matchesQuery(s.label, search),
  );

  const showTransactionGroup = debouncedSearch.length >= 2;
  const nothingFound =
    filteredRoutes.length === 0 &&
    filteredActions.length === 0 &&
    filteredSettings.length === 0 &&
    (!showTransactionGroup || (!isSearching && hits.length === 0));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
        aria-label="Befehlspalette öffnen"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Suche</span>
        <kbd className="pointer-events-none ml-1 hidden select-none rounded border border-border bg-muted px-1 text-[10px] font-mono font-medium sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Seite, Aktion oder Buchung suchen…"
        />
        <CommandList>
          {nothingFound ? (
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          ) : null}

          {filteredRoutes.length > 0 ? (
            <CommandGroup heading="Navigation">
              {filteredRoutes.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} onSelect={() => navigate(href)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {filteredActions.length > 0 ? (
            <>
              {filteredRoutes.length > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading="Aktionen">
                {filteredActions.map(({ key, label, icon: Icon, onSelect }) => (
                  <CommandItem key={key} onSelect={onSelect}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {showTransactionGroup ? (
            <>
              {filteredRoutes.length > 0 || filteredActions.length > 0 ? (
                <CommandSeparator />
              ) : null}
              <CommandGroup
                heading={
                  activeTrackers.length === 1
                    ? `Buchungen in ${activeTrackers[0].name}`
                    : "Buchungen"
                }
              >
                {isSearching ? (
                  <CommandItem disabled className="justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Suche läuft…
                  </CommandItem>
                ) : (
                  hits.map((hit) => {
                    const DirIcon =
                      hit.direction === "income" ? ArrowUpRight : ArrowDownLeft;
                    const label =
                      hit.categoryName ||
                      hit.payeeName ||
                      hit.customPayeeName ||
                      hit.notes ||
                      "Buchung";
                    const subtitle = [
                      showTrackerBadge ? hit.trackerName : null,
                      hit.payeeName || hit.customPayeeName,
                      hit.notes,
                    ]
                      .filter((part) => part && part !== label)
                      .join(" · ");

                    return (
                      <CommandItem
                        key={hit.id}
                        value={`tx-${hit.id}`}
                        onSelect={() =>
                          openTransactionSearch(debouncedSearch, hit.trackerId)
                        }
                      >
                        <DirIcon
                          className={
                            hit.direction === "income"
                              ? "mr-2 h-4 w-4 text-income"
                              : "mr-2 h-4 w-4 text-expense"
                          }
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{label}</span>
                          {subtitle ? (
                            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              {showTrackerBadge ? (
                                <span
                                  aria-hidden
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: hit.trackerColor ?? undefined,
                                  }}
                                />
                              ) : null}
                              <span className="truncate">{subtitle}</span>
                            </span>
                          ) : null}
                        </div>
                        <span className="ml-2 flex shrink-0 flex-col items-end text-right">
                          <Amount
                            cents={hit.amountCents}
                            currency={hit.currency}
                            direction={hit.direction}
                            size="xs"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateShort(hit.date)}
                          </span>
                        </span>
                      </CommandItem>
                    );
                  })
                )}
                {!isSearching ? (
                  <CommandItem
                    value="show-all-results"
                    onSelect={() =>
                      openTransactionSearch(debouncedSearch, hits[0]?.trackerId)
                    }
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Alle Treffer für „{debouncedSearch}“ anzeigen
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </>
          ) : null}

          {filteredSettings.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Einstellungen">
                {filteredSettings.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} onSelect={() => navigate(href)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <QuickAddSheet
        open={quickAddStep !== null}
        onOpenChange={(o) => {
          if (!o) setQuickAddStep(null);
        }}
        initialStep={quickAddStep ?? "pick"}
      />
    </>
  );
}
