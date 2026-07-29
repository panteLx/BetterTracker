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

type Category = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};

type CategoryFieldProps = {
  trackerId: string;
  locale: string;
  direction: "expense" | "income";
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Category picker with an inline "create new category" affordance, shared by
 * the dashboard quick-entry sheet and the quick-add sheet — both offer the
 * exact same create-while-booking flow.
 */
export function CategoryField({
  trackerId,
  locale,
  direction,
  options,
  value,
  onValueChange,
  disabled,
}: CategoryFieldProps) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: { trackerId: string; name: string; type: Category["type"] }) =>
      fetchJson<{ item: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<{ items: Category[] } | undefined>(
        ["categories", trackerId],
        (current) => ({
          items: sortByName([...(current?.items ?? []), item], locale),
        }),
      );
      toast.success("Kategorie angelegt");
      onValueChange(item.id);
      setNewName("");
      setShowNew(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Kategorie konnte nicht angelegt werden",
      ),
  });

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("Bitte einen Kategorienamen eingeben");
      return;
    }
    createMutation.mutate({ trackerId, name: newName.trim(), type: direction });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Kategorie</Label>
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
          if (next !== EMPTY_SELECT_VALUE) setShowNew(false);
        }}
        items={options}
        placeholder="Kategorie wählen"
        searchPlaceholder="Kategorie suchen"
        emptyMessage="Keine Kategorie gefunden."
        disabled={disabled}
      />
      {showNew ? (
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={disabled}
            placeholder={direction === "expense" ? "z. B. Tanken" : "z. B. Gehalt"}
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
      ) : null}
    </div>
  );
}
