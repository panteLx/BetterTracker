"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchJson } from "@/lib/client-fetch";
import { EMPTY_SELECT_VALUE, sortByName } from "@/lib/utils";

type Payee = {
  id: string;
  name: string;
  isActive: boolean;
};

type PayeeFieldProps = {
  trackerId: string;
  locale: string;
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  customName: string;
  onCustomNameChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Payee picker with an inline "create new payee" affordance and a one-off
 * free-text fallback, shared by the dashboard quick-entry sheet and the
 * quick-add sheet — both offer the exact same create-while-booking flow.
 */
export function PayeeField({
  trackerId,
  locale,
  options,
  value,
  onValueChange,
  customName,
  onCustomNameChange,
  disabled,
}: PayeeFieldProps) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string }) =>
      fetchJson<{ item: Payee }>("/api/payees", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Payee[] } | undefined>(
        ["payees", trackerId],
        (current) => ({
          items: sortByName([...(current?.items ?? []), item], locale),
        }),
      );
      toast.success("Einzahler angelegt");
      onValueChange(item.id);
      onCustomNameChange("");
      setNewName("");
      setShowNew(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Einzahler konnte nicht angelegt werden",
      ),
  });

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("Bitte einen Einzahler-Namen eingeben");
      return;
    }
    createMutation.mutate({ trackerId, name: newName.trim() });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Einzahler</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowNew((current) => !current)}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Neu
        </Button>
      </div>
      <SearchableSelect
        value={value}
        onValueChange={(next) => {
          onValueChange(next);
          if (next !== EMPTY_SELECT_VALUE) {
            onCustomNameChange("");
            setShowNew(false);
          }
        }}
        items={options}
        placeholder="Einzahler wählen"
        searchPlaceholder="Einzahler suchen"
        emptyMessage="Kein Einzahler gefunden."
        disabled={disabled}
      />
      {showNew ? (
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={disabled}
            placeholder="z. B. Bäckerei"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={createMutation.isPending || disabled}
          >
            {createMutation.isPending ? "..." : "Anlegen"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => {
              setShowNew(false);
              setNewName("");
            }}
          >
            ✕
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="custom-payee" className="text-xs text-muted-foreground">
            Oder einmaliger Freitext
          </Label>
          <Input
            id="custom-payee"
            value={customName}
            onChange={(event) => {
              onCustomNameChange(event.target.value);
              if (event.target.value.trim()) onValueChange(EMPTY_SELECT_VALUE);
            }}
            disabled={disabled}
            placeholder="z. B. Wochenmarkt"
          />
        </div>
      )}
    </div>
  );
}
