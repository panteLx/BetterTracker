"use client";

import { FormEvent, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, toDateInputValue, parseAmountToCents } from "@/lib/utils";

const EMPTY = "none";
type Step = "pick" | "buchung" | "termin";
type Direction = "expense" | "income";
type Frequency = "monthly" | "yearly" | "custom_days";

type Tracker = { id: string; name: string; color: string; currency: string; isActive: boolean };
type Category = { id: string; name: string; type: "expense" | "income" | "transfer"; isActive: boolean };
type Payee = { id: string; name: string; isActive: boolean };

const FREQ_OPTIONS: { value: Frequency; intervalValue: number; label: string }[] = [
  { value: "custom_days", intervalValue: 1, label: "Täglich" },
  { value: "custom_days", intervalValue: 7, label: "Wöchentlich" },
  { value: "monthly", intervalValue: 1, label: "Monatlich" },
  { value: "yearly", intervalValue: 1, label: "Jährlich" },
];

type FreqKey = "daily" | "weekly" | "monthly" | "yearly";
const FREQ_KEY_MAP: Record<FreqKey, { value: Frequency; intervalValue: number }> = {
  daily: { value: "custom_days", intervalValue: 1 },
  weekly: { value: "custom_days", intervalValue: 7 },
  monthly: { value: "monthly", intervalValue: 1 },
  yearly: { value: "yearly", intervalValue: 1 },
};

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

function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (v: Direction) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-1">
      <button
        type="button"
        onClick={() => onChange("expense")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition",
          value === "expense"
            ? "bg-expense text-expense-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ArrowDownLeft className="mr-1 inline h-3.5 w-3.5" />
        Ausgabe
      </button>
      <button
        type="button"
        onClick={() => onChange("income")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition",
          value === "income"
            ? "bg-income text-income-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />
        Einnahme
      </button>
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

  // Schedule-only state
  const [scheduleName, setScheduleName] = useState("");
  const [freqKey, setFreqKey] = useState<FreqKey>("monthly");

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

  const categories = (categoriesQuery.data?.items ?? []).filter(
    (c) => c.isActive && (c.type === direction || c.type === "transfer"),
  );
  const payees = (payeesQuery.data?.items ?? []).filter((p) => p.isActive);

  const categoryOptions = [
    { value: EMPTY, label: "Keine Kategorie" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const payeeOptions = [
    { value: EMPTY, label: "Freier Name / Anonym" },
    ...payees.map((p) => ({ value: p.id, label: p.name })),
  ];

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
      setDone("termin");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Fehler beim Speichern"),
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
    setFreqKey("monthly");
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

  function handleSubmitTransaction(e: FormEvent) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    if (!cents || cents <= 0) { toast.error("Bitte einen gültigen Betrag eingeben."); return; }
    txMutation.mutate({
      trackerId: activeTrackerId,
      date,
      amountCents: cents,
      direction,
      categoryId: categoryId === EMPTY ? null : categoryId,
      payeeId: payeeId === EMPTY ? null : payeeId,
      customPayeeName: customPayeeName.trim() || null,
      notes: notes.trim() || null,
    });
  }

  function handleSubmitSchedule(e: FormEvent) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    if (!cents || cents <= 0) { toast.error("Bitte einen gültigen Betrag eingeben."); return; }
    if (!scheduleName.trim()) { toast.error("Bitte einen Namen eingeben."); return; }
    if (payeeId === EMPTY && !customPayeeName.trim()) {
      toast.error("Bitte einen Empfänger/Absender angeben.");
      return;
    }
    if (categoryId === EMPTY) { toast.error("Bitte eine Kategorie wählen."); return; }
    const freq = FREQ_KEY_MAP[freqKey];
    scheduleMutation.mutate({
      trackerId: activeTrackerId,
      name: scheduleName.trim(),
      amount: cents,
      direction,
      categoryId,
      payeeId: payeeId === EMPTY ? null : payeeId,
      notesTemplate: customPayeeName.trim() || null,
      frequency: freq.value,
      intervalValue: freq.intervalValue,
      nextDueDate: date,
    });
  }

  const isPending = txMutation.isPending || scheduleMutation.isPending;

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
                <p className="text-sm text-muted-foreground">
                  Einnahme oder Ausgabe erfassen
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Wiederkehrende Zahlung anlegen
                </p>
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
            </div>
            <div className="flex-1 overflow-y-auto">
              {done === "buchung" ? (
                <SuccessView
                  label="Buchung gespeichert!"
                  onAnother={() => { resetForm(); }}
                  onClose={() => handleClose(false)}
                />
              ) : (
                <form onSubmit={handleSubmitTransaction} className="space-y-4 p-4">
                  <TrackerPills
                    trackers={trackers}
                    activeId={activeTrackerId}
                    onChange={handleTrackerChange}
                  />
                  <DirectionToggle value={direction} onChange={handleDirectionChange} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="qa-tx-amount">Betrag</Label>
                      <Input
                        id="qa-tx-amount"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Datum</Label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <SearchableSelect
                      value={categoryId}
                      onValueChange={setCategoryId}
                      items={categoryOptions}
                      placeholder="Kategorie wählen"
                      searchPlaceholder="Suchen…"
                      emptyMessage="Keine Kategorie gefunden."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Empfänger / Absender</Label>
                    <SearchableSelect
                      value={payeeId}
                      onValueChange={(v) => {
                        setPayeeId(v);
                        if (v !== EMPTY) setCustomPayeeName("");
                      }}
                      items={payeeOptions}
                      placeholder="Aus Liste wählen"
                      searchPlaceholder="Suchen…"
                      emptyMessage="Kein Eintrag gefunden."
                    />
                    {payeeId === EMPTY && (
                      <Input
                        placeholder="Oder freien Namen eingeben"
                        value={customPayeeName}
                        onChange={(e) => setCustomPayeeName(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qa-tx-notes">Notiz (optional)</Label>
                    <Input
                      id="qa-tx-notes"
                      placeholder="z. B. Rechnung Nr. 123"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending || !activeTrackerId}>
                    {isPending ? "Wird gespeichert…" : "Buchung speichern"}
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
                  onAnother={() => { resetForm(); }}
                  onClose={() => handleClose(false)}
                />
              ) : (
                <form onSubmit={handleSubmitSchedule} className="space-y-4 p-4">
                  <TrackerPills
                    trackers={trackers}
                    activeId={activeTrackerId}
                    onChange={handleTrackerChange}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="qa-sc-name">Bezeichnung</Label>
                    <Input
                      id="qa-sc-name"
                      placeholder="z. B. Miete, Netflix, Gehalt"
                      value={scheduleName}
                      onChange={(e) => setScheduleName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <DirectionToggle value={direction} onChange={handleDirectionChange} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="qa-sc-amount">Betrag</Label>
                      <Input
                        id="qa-sc-amount"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Wiederholung</Label>
                      <Select
                        value={freqKey}
                        onValueChange={(v) => setFreqKey(v as FreqKey)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQ_OPTIONS.map((f) => (
                            <SelectItem
                              key={f.label}
                              value={
                                f.label === "Täglich"
                                  ? "daily"
                                  : f.label === "Wöchentlich"
                                    ? "weekly"
                                    : f.label === "Monatlich"
                                      ? "monthly"
                                      : "yearly"
                              }
                            >
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nächste Fälligkeit</Label>
                    <DatePicker value={date} onChange={setDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kategorie *</Label>
                    <SearchableSelect
                      value={categoryId}
                      onValueChange={setCategoryId}
                      items={categoryOptions}
                      placeholder="Kategorie wählen (Pflicht)"
                      searchPlaceholder="Suchen…"
                      emptyMessage="Keine Kategorie gefunden."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Empfänger / Absender *</Label>
                    <SearchableSelect
                      value={payeeId}
                      onValueChange={(v) => {
                        setPayeeId(v);
                        if (v !== EMPTY) setCustomPayeeName("");
                      }}
                      items={payeeOptions}
                      placeholder="Aus Liste wählen (Pflicht)"
                      searchPlaceholder="Suchen…"
                      emptyMessage="Kein Eintrag gefunden."
                    />
                    {payeeId === EMPTY && (
                      <Input
                        placeholder="Oder freien Namen eingeben"
                        value={customPayeeName}
                        onChange={(e) => setCustomPayeeName(e.target.value)}
                      />
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending || !activeTrackerId}>
                    {isPending ? "Wird gespeichert…" : "Termin speichern"}
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
