"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { fetchJson } from "@/lib/client-fetch";
import { EMPTY_SELECT_VALUE, sortByName } from "@/lib/utils";

type EntityKind = "category" | "payee";

type CreatedCategory = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer";
  isActive: boolean;
};
type CreatedPayee = { id: string; name: string; isActive: boolean };

type EntityPickerProps = {
  kind: EntityKind;
  trackerId: string;
  locale: string;
  label: string;
  options: ComboboxItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Schedules require a real category/payee; transaction payees don't. */
  required: boolean;
  /** Required when kind === "category" — feeds the create-new `type` field. */
  direction?: "expense" | "income";
  /** Only ever true for transaction payees. */
  allowCustomText?: boolean;
  customTextValue?: string;
  onCustomTextChange?: (value: string) => void;
  disabled?: boolean;
};

/**
 * Shared category/payee picker: a mobile bottom Drawer / desktop Popover
 * (via Combobox) with an inline "create new" sub-view swapped into the same
 * surface, plus an optional one-off free-text fallback for transaction payees.
 * Replaces the previously separate CategoryField/PayeeField/raw-SearchableSelect
 * implementations used across dashboard, quick-add, transactions and schedules.
 */
export function EntityPicker({
  kind,
  trackerId,
  locale,
  label,
  options,
  value,
  onValueChange,
  required,
  direction,
  allowCustomText,
  customTextValue,
  onCustomTextChange,
  disabled,
}: EntityPickerProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("Transactions.entityPicker");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");

  const isCategory = kind === "category";
  const queryKey = [isCategory ? "categories" : "payees", trackerId];
  const endpoint = isCategory ? "/api/categories" : "/api/payees";

  const copy = isCategory
    ? {
        placeholder: t("category.placeholder"),
        searchPlaceholder: t("category.searchPlaceholder"),
        emptyMessage: t("category.emptyMessage"),
        createLabel: t("category.createLabel"),
        namePlaceholder:
          direction === "expense"
            ? t("category.namePlaceholderExpense")
            : t("category.namePlaceholderIncome"),
        toastCreated: t("category.toastCreated"),
        toastNameRequired: t("category.toastNameRequired"),
        toastCreateError: t("category.toastCreateError"),
        noneOption: t("category.noneOption"),
      }
    : {
        placeholder: t("payee.placeholder"),
        searchPlaceholder: t("payee.searchPlaceholder"),
        emptyMessage: t("payee.emptyMessage"),
        createLabel: t("payee.createLabel"),
        namePlaceholder: t("payee.namePlaceholder"),
        toastCreated: t("payee.toastCreated"),
        toastNameRequired: t("payee.toastNameRequired"),
        toastCreateError: t("payee.toastCreateError"),
        noneOption: t("payee.noneOption"),
      };

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ item: CreatedCategory | CreatedPayee }>(endpoint, {
        method: "POST",
        body: JSON.stringify(
          isCategory
            ? { trackerId, name: newName.trim(), type: direction }
            : { trackerId, name: newName.trim() },
        ),
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<
        { items: (CreatedCategory | CreatedPayee)[] } | undefined
      >(queryKey, (current) => ({
        items: sortByName([...(current?.items ?? []), item], locale),
      }));
      toast.success(copy.toastCreated);
      onValueChange(item.id);
      onCustomTextChange?.("");
      setNewName("");
      setMode("list");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : copy.toastCreateError,
      ),
  });

  function handleCreate() {
    if (!newName.trim()) {
      toast.error(copy.toastNameRequired);
      return;
    }
    createMutation.mutate();
  }

  const items = required
    ? options
    : [
        {
          value: EMPTY_SELECT_VALUE,
          label: copy.noneOption,
        },
        ...options,
      ];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Combobox
        value={value}
        onValueChange={(next) => {
          onValueChange(next);
          if (next !== EMPTY_SELECT_VALUE) {
            onCustomTextChange?.("");
          }
        }}
        items={items}
        placeholder={copy.placeholder}
        searchPlaceholder={copy.searchPlaceholder}
        emptyMessage={copy.emptyMessage}
        disabled={disabled}
        invalid={required && (!value || value === EMPTY_SELECT_VALUE)}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setMode("list");
            setNewName("");
          }
        }}
        footer={
          mode === "list" ? (
            <div className="border-t p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => setMode("create")}
                disabled={disabled}
              >
                <Plus className="h-3.5 w-3.5" />
                {copy.createLabel}
              </Button>
            </div>
          ) : null
        }
        content={
          mode === "create" ? (
            <div className="flex h-full flex-col gap-3 p-4 animate-in fade-in slide-in-from-bottom-1 duration-(--motion-duration-base)">
              <div className="space-y-1.5">
                <Label
                  htmlFor={`new-${kind}-name`}
                  className="text-xs text-muted-foreground"
                >
                  {t("nameLabel")}
                </Label>
                <Input
                  id={`new-${kind}-name`}
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder={copy.namePlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreate();
                    }
                  }}
                />
                {isCategory ? (
                  <p className="text-xs text-muted-foreground">
                    {t("typeLine", {
                      type:
                        direction === "expense"
                          ? t("typeExpense")
                          : t("typeIncome"),
                    })}
                  </p>
                ) : null}
              </div>
              <div className="mt-auto flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setMode("list");
                    setNewName("");
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? t("creating") : t("create")}
                </Button>
              </div>
            </div>
          ) : null
        }
      />
      {allowCustomText && !required ? (
        <div className="space-y-1.5">
          <Label
            htmlFor="custom-payee"
            className="text-xs text-muted-foreground"
          >
            {t("customTextLabel")}
          </Label>
          <Input
            id="custom-payee"
            value={customTextValue ?? ""}
            onChange={(event) => {
              onCustomTextChange?.(event.target.value);
              if (event.target.value.trim()) onValueChange(EMPTY_SELECT_VALUE);
            }}
            disabled={disabled}
            placeholder={t("customTextPlaceholder")}
          />
        </div>
      ) : null}
    </div>
  );
}
