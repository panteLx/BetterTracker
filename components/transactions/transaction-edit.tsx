"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { amountToInputValue, EMPTY_SELECT_VALUE, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DirectionToggle } from "@/components/ui/direction-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityPicker } from "@/components/transactions/entity-picker";

export type EditableTransaction = {
  id: string;
  date: string;
  amountCents: number;
  direction: "expense" | "income";
  categoryId?: string | null;
  payeeId?: string | null;
  customPayeeName?: string | null;
  notes?: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

type EditTransactionState = {
  date: string;
  amount: string;
  direction: "expense" | "income";
  categoryId: string;
  payeeId: string;
  customPayeeName: string;
  notes: string;
};

type EditableCategory = { id: string; name: string; type: "expense" | "income" | "transfer" };
type EditablePayee = { id: string; name: string };

/**
 * Edit/delete state and mutations for a transaction list, shared between the
 * transactions page and the dashboard's "Letzte Buchungen" panel so both stay
 * in lockstep instead of drifting apart.
 */
export function useTransactionEdit(trackerId: string) {
  const queryClient = useQueryClient();
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [editState, setEditState] = useState<EditTransactionState | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) =>
      fetchJson(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      setEditingTransactionId("");
      setEditState(null);
      queryClient.invalidateQueries({ queryKey: ["transactions", trackerId] });
      queryClient.invalidateQueries({ queryKey: ["payees", trackerId] });
      queryClient.invalidateQueries({ queryKey: ["categories", trackerId] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Transaktion gelöscht");
      queryClient.invalidateQueries({ queryKey: ["transactions", trackerId] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen",
      );
    },
  });

  function startEdit(item: EditableTransaction) {
    setEditingTransactionId(item.id);
    setEditState({
      date: item.date,
      amount: amountToInputValue(item.amountCents),
      direction: item.direction,
      categoryId: item.categoryId ?? "",
      payeeId: item.payeeId ?? EMPTY_SELECT_VALUE,
      customPayeeName: item.customPayeeName ?? "",
      notes: item.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingTransactionId("");
    setEditState(null);
  }

  function toggleEdit(item: EditableTransaction) {
    if (editingTransactionId === item.id) {
      cancelEdit();
    } else {
      startEdit(item);
    }
  }

  function submitEdit(id: string) {
    if (!editState) return;

    if (!editState.date || !editState.amount.trim() || !editState.categoryId) {
      toast.error("Datum, Betrag und Kategorie sind Pflichtfelder");
      return;
    }

    updateMutation.mutate({
      id,
      payload: {
        date: editState.date,
        amount: editState.amount,
        direction: editState.direction,
        categoryId: editState.categoryId,
        payeeId:
          editState.payeeId === EMPTY_SELECT_VALUE ? null : editState.payeeId,
        customPayeeName: editState.customPayeeName.trim() || null,
        notes: editState.notes.trim() || null,
      },
    });
  }

  return {
    editingTransactionId,
    editState,
    setEditState,
    startEdit,
    cancelEdit,
    toggleEdit,
    submitEdit,
    updateMutation,
    deleteMutation,
  };
}

type TransactionEditFormProps = {
  trackerId: string;
  locale: string;
  editState: EditTransactionState;
  onEditStateChange: (
    updater: (current: EditTransactionState) => EditTransactionState,
  ) => void;
  categories: EditableCategory[];
  payees: EditablePayee[];
  onCancel: () => void;
  onSubmit: () => void;
  isSaving: boolean;
};

export function TransactionEditForm({
  trackerId,
  locale,
  editState,
  onEditStateChange,
  categories,
  payees,
  onCancel,
  onSubmit,
  isSaving,
}: TransactionEditFormProps) {
  const filteredCategories = categories.filter(
    (category) =>
      category.type === editState.direction || category.type === "transfer",
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Datum</Label>
          <DatePicker
            value={editState.date}
            onChange={(value) =>
              onEditStateChange((current) => ({ ...current, date: value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Betrag</Label>
          <Input
            value={editState.amount}
            onChange={(event) =>
              onEditStateChange((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            placeholder="12,50"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Typ</Label>
        <DirectionToggle
          size="sm"
          value={editState.direction}
          onValueChange={(value) =>
            onEditStateChange((current) => ({
              ...current,
              direction: value,
              categoryId: EMPTY_SELECT_VALUE,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EntityPicker
          kind="category"
          trackerId={trackerId}
          locale={locale}
          label="Kategorie"
          options={filteredCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          value={editState.categoryId || EMPTY_SELECT_VALUE}
          onValueChange={(value) =>
            onEditStateChange((current) => ({ ...current, categoryId: value }))
          }
          required
          direction={editState.direction}
        />

        <EntityPicker
          kind="payee"
          trackerId={trackerId}
          locale={locale}
          label="Einzahler"
          options={payees.map((payee) => ({
            value: payee.id,
            label: payee.name,
          }))}
          value={editState.payeeId}
          onValueChange={(value) =>
            onEditStateChange((current) => ({
              ...current,
              payeeId: value,
              customPayeeName:
                value === EMPTY_SELECT_VALUE ? current.customPayeeName : "",
            }))
          }
          required={false}
          allowCustomText
          customTextValue={editState.customPayeeName}
          onCustomTextChange={(value) =>
            onEditStateChange((current) => ({
              ...current,
              customPayeeName: value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Notizen</Label>
        <Textarea
          value={editState.notes}
          onChange={(event) =>
            onEditStateChange((current) => ({
              ...current,
              notes: event.target.value,
            }))
          }
          rows={2}
          placeholder="Optional"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="button" size="sm" onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Speichert..." : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

type TransactionRowActionsProps = {
  item: EditableTransaction;
  isArchived: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  locale: string;
  onToggleEdit: () => void;
  onDelete: () => void;
};

export function TransactionRowActions({
  item,
  isArchived,
  isSaving,
  isDeleting,
  locale,
  onToggleEdit,
  onDelete,
}: TransactionRowActionsProps) {
  if (isArchived || (!item.canEdit && !item.canDelete)) return null;

  return (
    <>
      {item.canEdit ? (
        <Button
          variant="ghost"
          size="icon-sm"
          shape="pill"
          title="Bearbeiten"
          aria-label={`Buchung vom ${formatDateShort(item.date, locale)} bearbeiten`}
          disabled={isSaving}
          onClick={onToggleEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {item.canDelete ? (
        <Button
          variant="ghost"
          size="icon-sm"
          shape="pill"
          title="Löschen"
          aria-label={`Buchung vom ${formatDateShort(item.date, locale)} löschen`}
          className="text-expense hover:bg-expense-muted hover:text-expense"
          disabled={isDeleting}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );
}
