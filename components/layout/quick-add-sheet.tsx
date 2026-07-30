"use client";

import { FormEvent, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { EntityPicker } from "@/components/transactions/entity-picker";
import { TrackerPillRow } from "@/components/trackers/tracker-pill-row";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DirectionToggle } from "@/components/ui/direction-toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/client-fetch";
import { LAST_TRACKER_KEY } from "@/lib/last-tracker";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import {
  cn,
  EMPTY_SELECT_VALUE as EMPTY,
  getFrequencyLabel,
  toDateInputValue,
} from "@/lib/utils";

type Step = "pick" | "buchung" | "termin";
type Direction = "expense" | "income";
type Frequency = "monthly" | "yearly" | "custom_days";

type Tracker = {
  id: string;
  name: string;
  color: string;
  currency: string;
  isActive: boolean;
  permission?: "owner" | "admin" | "write" | "read";
};
type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};
type Payee = { id: string; name: string; isActive: boolean };

export function QuickAddSheet({
  open,
  onOpenChange,
  defaultTrackerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselects a tracker. Defaults to the one you last worked in. Ignored if
   *  that tracker no longer exists or has been archived. */
  defaultTrackerId?: string;
}) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
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

  const [entryFieldsKey, setEntryFieldsKey] = useState(0);

  // Schedule-only state
  const [scheduleName, setScheduleName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [notesTemplate, setNotesTemplate] = useState("");

  // Only a fallback: an explicit pick inside the sheet always wins, so a
  // change to the stored value can't yank the form out from under you.
  const recalledTrackerId = useLocalStorageValue(LAST_TRACKER_KEY) ?? undefined;

  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: () => fetchJson<{ items: Tracker[] }>("/api/trackers"),
    enabled: open,
  });
  const trackers = trackersQuery.data?.items ?? [];
  const selectableTrackers = trackers.filter(
    (t) => t.isActive && t.permission !== "read",
  );
  const preferredTrackerId = defaultTrackerId ?? recalledTrackerId;
  const preselected = selectableTrackers.some(
    (t) => t.id === preferredTrackerId,
  )
    ? preferredTrackerId
    : undefined;
  const activeTrackerId =
    selectedTrackerId || preselected || selectableTrackers[0]?.id || "";

  const categoriesQuery = useQuery({
    queryKey: ["categories", activeTrackerId],
    queryFn: () =>
      fetchJson<{ items: Category[] }>(
        `/api/categories?trackerId=${activeTrackerId}`,
      ),
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

  const effectiveCategoryId = filteredCategories.some(
    (c) => c.id === categoryId,
  )
    ? categoryId
    : EMPTY;

  const categoryOptions = filteredCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const payeeOptions = payees.map((p) => ({ value: p.id, label: p.name }));

  const parsedIntervalValue = Number(intervalValue);
  const normalizedIntervalValue =
    Number.isFinite(parsedIntervalValue) && parsedIntervalValue > 0
      ? parsedIntervalValue
      : 1;

  const txMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson("/api/transactions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDone("buchung");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern"),
  });

  const scheduleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson("/api/schedules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-forecast"] });
      setDone("termin");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern"),
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
    setEntryFieldsKey((current) => current + 1);
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

  const isMutating = txMutation.isPending || scheduleMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          isMobile ? "rounded-t-2xl" : "sm:max-w-md",
        )}
        style={
          isMobile
            ? { paddingBottom: "env(safe-area-inset-bottom)" }
            : undefined
        }
      >
        <SheetTitle className="sr-only">Hinzufügen</SheetTitle>
        <SheetDescription className="sr-only">
          Neue Buchung oder Termin anlegen
        </SheetDescription>

        {isMobile ? (
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted" />
        ) : null}

        {/* ── PICKER ─────────────────────────────────────────────── */}
        {step === "pick" && (
          <div className="space-y-3 p-5 pt-4">
            <p className="text-base font-semibold">
              Was möchtest du hinzufügen?
            </p>
            <button
              type="button"
              onClick={() => setStep("buchung")}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-(--motion-duration-fast) hover:border-border-strong hover:bg-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle">
                <Receipt className="h-5 w-5 text-primary-on" />
              </div>
              <div>
                <p className="font-medium">Buchung</p>
                <p className="font-subtext text-sm text-muted-foreground">
                  Einnahme oder Ausgabe erfassen
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStep("termin")}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-(--motion-duration-fast) hover:border-border-strong hover:bg-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Termin</p>
                <p className="font-subtext text-sm text-muted-foreground">
                  Wiederkehrende Zahlung anlegen
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── BUCHUNG FORM ───────────────────────────────────────── */}
        {step === "buchung" && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border py-3 pl-4 pr-14">
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
                <DirectionToggle
                  value={direction}
                  onValueChange={handleDirectionChange}
                  icons
                />
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
                <form
                  onSubmit={handleSubmitTransaction}
                  className="space-y-4 p-4"
                >
                  {selectableTrackers.length > 1 ? (
                    <div className="space-y-2">
                      <Label>Tracker</Label>
                      <TrackerPillRow
                        trackers={selectableTrackers}
                        activeTrackerId={activeTrackerId}
                        onSelect={handleTrackerChange}
                      />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="qa-tx-date">Datum</Label>
                      <DatePicker
                        id="qa-tx-date"
                        value={date}
                        onChange={setDate}
                      />
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

                  <EntityPicker
                    key={`buchung-category-${entryFieldsKey}`}
                    kind="category"
                    trackerId={activeTrackerId}
                    locale="de"
                    label="Kategorie"
                    direction={direction}
                    options={categoryOptions}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    required
                  />

                  <EntityPicker
                    key={`buchung-payee-${entryFieldsKey}`}
                    kind="payee"
                    trackerId={activeTrackerId}
                    locale="de"
                    label="Einzahler"
                    options={payeeOptions}
                    value={payeeId}
                    onValueChange={setPayeeId}
                    required={false}
                    allowCustomText
                    customTextValue={customPayeeName}
                    onCustomTextChange={setCustomPayeeName}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="qa-tx-notes">Notizen (optional)</Label>
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
                    disabled={
                      isMutating ||
                      !activeTrackerId ||
                      effectiveCategoryId === EMPTY
                    }
                  >
                    {txMutation.isPending
                      ? "Speichere..."
                      : "Eintrag speichern"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}

        {/* ── TERMIN FORM ────────────────────────────────────────── */}
        {step === "termin" && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border py-3 pl-4 pr-14">
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
                  {selectableTrackers.length > 1 ? (
                    <div className="space-y-2">
                      <Label>Tracker</Label>
                      <TrackerPillRow
                        trackers={selectableTrackers}
                        activeTrackerId={activeTrackerId}
                        onSelect={handleTrackerChange}
                      />
                    </div>
                  ) : null}
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

                  <DirectionToggle
                    size="md"
                    value={direction}
                    onValueChange={(next) => {
                      setDirection(next);
                      setCategoryId(EMPTY);
                    }}
                  />

                  {/* Category */}
                  <EntityPicker
                    key={`termin-category-${entryFieldsKey}`}
                    kind="category"
                    trackerId={activeTrackerId}
                    locale="de"
                    label="Kategorie"
                    direction={direction}
                    options={categoryOptions}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    required
                  />

                  {/* Payee */}
                  <EntityPicker
                    key={`termin-payee-${entryFieldsKey}`}
                    kind="payee"
                    trackerId={activeTrackerId}
                    locale="de"
                    label="Einzahler"
                    options={payeeOptions}
                    value={payeeId}
                    onValueChange={setPayeeId}
                    required
                  />

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
                            <SelectItem value="custom_days">
                              Alle X Tage
                            </SelectItem>
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
                    {scheduleMutation.isPending
                      ? "Speichere..."
                      : "Termin anlegen"}
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
          Mehr hinzufügen
        </Button>
        <Button size="sm" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </div>
  );
}
