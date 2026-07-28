"use client";

import { FormEvent, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { cn, toDateInputValue } from "@/lib/utils";

const EMPTY = "none";
type Step = "pick" | "buchung" | "termin";
type Direction = "expense" | "income";
type Frequency = "monthly" | "yearly" | "custom_days";

type Tracker = { id: string; name: string; color: string; currency: string; isActive: boolean };
type Category = { id: string; name: string; type: "expense" | "income" | "transfer"; isActive: boolean };
type Payee = { id: string; name: string; isActive: boolean };

function sortByName<T extends { name: string }>(items: T[], locale: string): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, locale));
}

function getFrequencyLabel(frequency: Frequency, intervalValue: number): string {
  if (frequency === "monthly") {
    return intervalValue === 1 ? "Monatlich" : `Alle ${intervalValue} Monate`;
  }
  if (frequency === "yearly") {
    return intervalValue === 1 ? "Jährlich" : `Alle ${intervalValue} Jahre`;
  }
  return intervalValue === 1 ? "Täglich" : `Alle ${intervalValue} Tage`;
}

function TrackerPills({
  trackers,
  activeId,
  onChange,
}: {
  trackers: Tracker[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const active = trackers.filter((t) => t.isActive);
  if (active.length <= 1) return null;
  return (
    <div className="space-y-2">
      <Label>Tracker</Label>
      <div className="flex flex-wrap gap-2">
        {active.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              activeId === t.id
                ? "border-transparent bg-foreground text-background"
                : "border-border/70 bg-background/75 hover:bg-accent",
            )}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: t.color || "#0f766e" }}
            />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickAddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("pick");
  const [done, setDone] = useState<Step | null>(null);

  // Shared state
  const [selectedTrackerId, setSelectedTrackerId] = useState("");
  const [direction, setDirection] = useState<Direction>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [categoryId, setCategoryId] = useState(EMPTY);
  const [payeeId, setPayeeId] = useState(EMPTY);
  const [customPayeeName, setCustomPayeeName] = useState("");
  const [notes, setNotes] = useState("");

  // Inline creation state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewPayee, setShowNewPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState("");

  // Schedule-only state
  const [scheduleName, setScheduleName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [notesTemplate, setNotesTemplate] = useState("");

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
    enabled: open,
  });
  const trackers = trackersQuery.data?.items ?? [];
  const activeTrackerId = selectedTrackerId || trackers.find((t) => t.isActive)?.id || "";

  const categoriesQuery = useQuery({
    queryKey: ["categories", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Category[] }>(`/api/categories?trackerId=${activeTrackerId}`),
    enabled: !!activeTrackerId && step !== "pick",
  });
  const payeesQuery = useQuery({
    queryKey: ["payees", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Payee[] }>(`/api/payees?trackerId=${activeTrackerId}`),
    enabled: !!activeTrackerId && step !== "pick",
  });

  const filteredCategories = (categoriesQuery.data?.items ?? []).filter(
    (c) => c.isActive && (c.type === direction || c.type === "transfer"),
  );
  const payees = (payeesQuery.data?.items ?? []).filter((p) => p.isActive);

  const effectiveCategoryId = filteredCategories.some((c) => c.id === categoryId)
    ? categoryId
    : EMPTY;

  const categoryOptions = [
    { value: EMPTY, label: "Bitte wählen" },
    ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const payeeOptions = [
    { value: EMPTY, label: "Anonym" },
    ...payees.map((p) => ({ value: p.id, label: p.name })),
  ];

  const parsedIntervalValue = Number(intervalValue);
  const normalizedIntervalValue =
    Number.isFinite(parsedIntervalValue) && parsedIntervalValue > 0
      ? parsedIntervalValue
      : 1;

  const txMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDone("buchung");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Fehler beim Speichern"),
  });

  const scheduleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson("/api/schedules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-forecast"] });
      setDone("termin");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Fehler beim Speichern"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string; type: Category["type"] }) =>
      fetchJson<{ item: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", activeTrackerId],
        (current) => ({
          items: sortByName([...(current?.items ?? []), item], "de"),
        }),
      );
      toast.success("Kategorie angelegt");
      setCategoryId(item.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Kategorie konnte nicht angelegt werden"),
  });

  const createPayeeMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string }) =>
      fetchJson<{ item: Payee }>("/api/payees", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Payee[] } | undefined>(
        ["payees", activeTrackerId],
        (current) => ({
          items: sortByName([...(current?.items ?? []), item], "de"),
        }),
      );
      toast.success("Einzahler angelegt");
      setPayeeId(item.id);
      setNewPayeeName("");
      setShowNewPayee(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Einzahler konnte nicht angelegt werden"),
  });

  function resetForm() {
    setAmount("");
    setNotes("");
    setCustomPayeeName("");
    setCategoryId(EMPTY);
    setPayeeId(EMPTY);
    setDirection("expense");
    setDate(toDateInputValue(new Date()));
    setScheduleName("");
    setFrequency("monthly");
    setIntervalValue("1");
    setNotesTemplate("");
    setShowNewCategory(false);
    setNewCategoryName("");
    setShowNewPayee(false);
    setNewPayeeName("");
    setDone(null);
  }

  function handleClose(o: boolean) {
    if (!o) {
      resetForm();
      setStep("pick");
    }
    onOpenChange(o);
  }

  function goBack() {
    resetForm();
    setStep("pick");
  }

  function handleDirectionChange(v: Direction) {
    setDirection(v);
    setCategoryId(EMPTY);
  }

  function handleTrackerChange(id: string) {
    setSelectedTrackerId(id);
    setCategoryId(EMPTY);
    setPayeeId(EMPTY);
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      toast.error("Bitte einen Kategorienamen eingeben");
      return;
    }
    createCategoryMutation.mutate({
      trackerId: activeTrackerId,
      name: newCategoryName.trim(),
      type: direction,
    });
  }

  function handleCreatePayee() {
    if (!newPayeeName.trim()) {
      toast.error("Bitte einen Einzahler-Namen eingeben");
      return;
    }
    createPayeeMutation.mutate({
      trackerId: activeTrackerId,
      name: newPayeeName.trim(),
    });
  }

  function handleSubmitTransaction(e: FormEvent) {
    e.preventDefault();
    if (!amount.trim()) {
      toast.error("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    if (effectiveCategoryId === EMPTY) {
      toast.error("Bitte eine Kategorie wählen.");
      return;
    }
    txMutation.mutate({
      trackerId: activeTrackerId,
      date,
      amount,
      direction,
      categoryId: effectiveCategoryId,
      payeeId: payeeId === EMPTY ? null : payeeId,
      customPayeeName: customPayeeName.trim() || null,
      notes: notes.trim() || null,
    });
  }

  function handleSubmitSchedule(e: FormEvent) {
    e.preventDefault();
    if (!amount.trim()) {
      toast.error("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    if (!scheduleName.trim()) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    if (categoryId === EMPTY) {
      toast.error("Bitte eine Kategorie wählen.");
      return;
    }
    if (payeeId === EMPTY) {
      toast.error("Bitte einen Empfänger/Absender angeben.");
      return;
    }
    scheduleMutation.mutate({
      trackerId: activeTrackerId,
      name: scheduleName.trim(),
      amount,
      direction,
      categoryId,
      payeeId,
      notesTemplate: notesTemplate.trim() || null,
      frequency,
      intervalValue: Number(intervalValue),
      nextDueDate: date,
    });
  }

  const isMutating =
    txMutation.isPending ||
    scheduleMutation.isPending ||
    createCategoryMutation.isPending ||
    createPayeeMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="flex flex-col gap-0 rounded-t-2xl p-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <SheetTitle className="sr-only">Hinzufügen</SheetTitle>
        <SheetDescription className="sr-only">Neue Buchung oder Termin anlegen</SheetDescription>

        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted" />

        {/* ── PICKER ─────────────────────────────────────────────── */}
        {step === "pick" && (
          <div className="space-y-3 p-5 pt-4">
            <p className="text-base font-semibold">Was möchtest du hinzufügen?</p>
            <button
              type="button"
              onClick={() => setStep("buchung")}
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:bg-muted active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Buchung</p>
                <p className="text-sm text-muted-foreground">Einnahme oder Ausgabe erfassen</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStep("termin")}
              className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:bg-muted active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Termin</p>
                <p className="text-sm text-muted-foreground">Wiederkehrende Zahlung anlegen</p>
              </div>
            </button>
          </div>
        )}

        {/* ── BUCHUNG FORM ───────────────────────────────────────── */}
        {step === "buchung" && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
              <button
                type="button"
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                aria-label="Zurück"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold">Neue Buchung</span>
              <div className="ml-auto">
                <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange("expense")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      direction === "expense"
                        ? "bg-expense text-expense-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ArrowDownLeft className="mr-1 inline h-3 w-3" />
                    Ausgabe
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionChange("income")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      direction === "income"
                        ? "bg-income text-income-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ArrowUpRight className="mr-1 inline h-3 w-3" />
                    Einnahme
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {done === "buchung" ? (
                <SuccessView
                  label="Buchung gespeichert!"
                  onAnother={resetForm}
                  onClose={() => handleClose(false)}
                />
              ) : (
                <form onSubmit={handleSubmitTransaction} className="space-y-4 p-4">
                  <TrackerPills
                    trackers={trackers}
                    activeId={activeTrackerId}
                    onChange={handleTrackerChange}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="qa-tx-date">Datum</Label>
                      <DatePicker id="qa-tx-date" value={date} onChange={setDate} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qa-tx-amount">Betrag</Label>
                      <Input
                        id="qa-tx-amount"
                        inputMode="decimal"
                        placeholder="12,50"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Kategorie</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setShowNewCategory((c) => !c)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Neu
                      </Button>
                    </div>
                    <SearchableSelect
                      value={categoryId}
                      onValueChange={(v) => {
                        setCategoryId(v);
                        if (v !== EMPTY) setShowNewCategory(false);
                      }}
                      items={categoryOptions}
                      placeholder="Kategorie wählen"
                      searchPlaceholder="Kategorie suchen"
                      emptyMessage="Keine Kategorie gefunden."
                    />
                    {showNewCategory ? (
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={direction === "expense" ? "z. B. Tanken" : "z. B. Gehalt"}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateCategory}
                          disabled={createCategoryMutation.isPending}
                        >
                          {createCategoryMutation.isPending ? "..." : "Anlegen"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => {
                            setShowNewCategory(false);
                            setNewCategoryName("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Payee */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Einzahler</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setShowNewPayee((c) => !c)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Neu
                      </Button>
                    </div>
                    <SearchableSelect
                      value={payeeId}
                      onValueChange={(v) => {
                        setPayeeId(v);
                        if (v !== EMPTY) {
                          setCustomPayeeName("");
                          setShowNewPayee(false);
                        }
                      }}
                      items={payeeOptions}
                      placeholder="Einzahler wählen"
                      searchPlaceholder="Einzahler suchen"
                      emptyMessage="Kein Einzahler gefunden."
                    />
                    {showNewPayee ? (
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={newPayeeName}
                          onChange={(e) => setNewPayeeName(e.target.value)}
                          placeholder="z. B. Bäckerei"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreatePayee}
                          disabled={createPayeeMutation.isPending}
                        >
                          {createPayeeMutation.isPending ? "..." : "Anlegen"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => {
                            setShowNewPayee(false);
                            setNewPayeeName("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Oder einmaliger Freitext
                        </Label>
                        <Input
                          value={customPayeeName}
                          onChange={(e) => {
                            setCustomPayeeName(e.target.value);
                            if (e.target.value.trim()) setPayeeId(EMPTY);
                          }}
                          placeholder="z. B. Wochenmarkt"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qa-tx-notes">Notizen</Label>
                    <Textarea
                      id="qa-tx-notes"
                      placeholder="Kurzer Kontext für die Buchung"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isMutating || !activeTrackerId || effectiveCategoryId === EMPTY}
                  >
                    {txMutation.isPending ? "Speichere..." : "Eintrag speichern"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}

        {/* ── TERMIN FORM ────────────────────────────────────────── */}
        {step === "termin" && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
              <button
                type="button"
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                aria-label="Zurück"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold">Neuer Termin</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {done === "termin" ? (
                <SuccessView
                  label="Termin gespeichert!"
                  onAnother={resetForm}
                  onClose={() => handleClose(false)}
                />
              ) : (
                <form onSubmit={handleSubmitSchedule} className="space-y-4 p-4">
                  <TrackerPills
                    trackers={trackers}
                    activeId={activeTrackerId}
                    onChange={handleTrackerChange}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="qa-sc-name">Bezeichnung</Label>
                      <Input
                        id="qa-sc-name"
                        placeholder="z. B. Miete, Netflix"
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qa-sc-amount">Betrag</Label>
                      <Input
                        id="qa-sc-amount"
                        inputMode="decimal"
                        placeholder="12,50"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection("expense");
                        setCategoryId(EMPTY);
                      }}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        direction === "expense"
                          ? "border-expense/30 bg-expense-muted text-expense"
                          : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <p className="font-medium">Ausgabe</p>
                      <p className="mt-1 text-xs">Abos, Miete, Fixkosten</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDirection("income");
                        setCategoryId(EMPTY);
                      }}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        direction === "income"
                          ? "border-income/30 bg-income-muted text-income"
                          : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <p className="font-medium">Einnahme</p>
                      <p className="mt-1 text-xs">Gehalt, Gutschriften</p>
                    </button>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Kategorie *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setShowNewCategory((c) => !c)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Neu
                      </Button>
                    </div>
                    <SearchableSelect
                      value={categoryId}
                      onValueChange={(v) => {
                        setCategoryId(v);
                        if (v !== EMPTY) setShowNewCategory(false);
                      }}
                      items={categoryOptions}
                      placeholder="Kategorie wählen"
                      searchPlaceholder="Kategorie suchen"
                      emptyMessage="Keine Kategorie gefunden."
                    />
                    {showNewCategory ? (
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={direction === "expense" ? "z. B. Tanken" : "z. B. Gehalt"}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateCategory}
                          disabled={createCategoryMutation.isPending}
                        >
                          {createCategoryMutation.isPending ? "..." : "Anlegen"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => {
                            setShowNewCategory(false);
                            setNewCategoryName("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Payee */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Einzahler *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setShowNewPayee((c) => !c)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Neu
                      </Button>
                    </div>
                    <SearchableSelect
                      value={payeeId}
                      onValueChange={(v) => {
                        setPayeeId(v);
                        if (v !== EMPTY) setShowNewPayee(false);
                      }}
                      items={payeeOptions}
                      placeholder="Einzahler wählen"
                      searchPlaceholder="Einzahler suchen"
                      emptyMessage="Kein Einzahler gefunden."
                    />
                    {showNewPayee ? (
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={newPayeeName}
                          onChange={(e) => setNewPayeeName(e.target.value)}
                          placeholder="z. B. Bäckerei"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreatePayee}
                          disabled={createPayeeMutation.isPending}
                        >
                          {createPayeeMutation.isPending ? "..." : "Anlegen"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => {
                            setShowNewPayee(false);
                            setNewPayeeName("");
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Frequency */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Rhythmus</p>
                    <div className="grid gap-3 grid-cols-3">
                      <div className="space-y-2">
                        <Label>Frequenz</Label>
                        <Select
                          value={frequency}
                          onValueChange={(v) => setFrequency(v as Frequency)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monatlich</SelectItem>
                            <SelectItem value="yearly">Jährlich</SelectItem>
                            <SelectItem value="custom_days">Alle X Tage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Intervall</Label>
                        <Input
                          value={intervalValue}
                          onChange={(e) => setIntervalValue(e.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Startdatum</Label>
                        <DatePicker value={date} onChange={setDate} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getFrequencyLabel(frequency, normalizedIntervalValue)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qa-sc-notes">Notizvorlage (optional)</Label>
                    <Textarea
                      id="qa-sc-notes"
                      placeholder="Wird beim Buchen übernommen"
                      value={notesTemplate}
                      onChange={(e) => setNotesTemplate(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isMutating || !activeTrackerId}
                  >
                    {scheduleMutation.isPending ? "Speichere..." : "Termin anlegen"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SuccessView({
  label,
  onAnother,
  onClose,
}: {
  label: string;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <CheckCircle2 className="h-12 w-12 text-income" />
      <p className="text-base font-semibold">{label}</p>
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={onAnother}>
          Weiteres hinzufügen
        </Button>
        <Button size="sm" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </div>
  );
}
