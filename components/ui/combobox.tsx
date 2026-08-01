"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export type ComboboxItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: ComboboxItem[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  /** Rendered below the list, outside cmdk's search filtering (e.g. a "create new" trigger). */
  footer?: React.ReactNode;
  /** When set, replaces the search list entirely (e.g. an inline "create new" form) while keeping the same responsive Drawer/Popover chrome. */
  content?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
};

/**
 * Responsive "search and pick one" primitive: a Drawer (vaul) on mobile for a
 * full-height, thumb-friendly list, a Popover on desktop. Domain-specific
 * behavior (create-new, free text, etc.) lives one layer up in EntityPicker.
 */
export function Combobox({
  value,
  onValueChange,
  items,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  loading,
  invalid,
  footer,
  content,
  open,
  onOpenChange,
  triggerClassName,
}: ComboboxProps) {
  const isMobile = useIsMobile();
  const t = useTranslations("Common");
  const selectedItem = items.find((item) => item.value === value);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      className={cn("w-full justify-between font-normal", triggerClassName)}
      disabled={disabled}
    >
      <span className="truncate">{selectedItem ? selectedItem.label : placeholder}</span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const body = content ? (
    content
  ) : (
    <Command className="flex h-full min-h-0 flex-col">
      <CommandInput
        placeholder={searchPlaceholder}
        className={cn(isMobile && "h-12 text-base")}
      />
      {loading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <CommandList
          className={cn("py-1", isMobile && "max-h-none flex-1 overflow-y-auto")}
        >
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          {items.map((item) => (
            <CommandItem
              key={item.value}
              value={item.label}
              disabled={item.disabled}
              onSelect={() => {
                onValueChange(item.value);
                onOpenChange(false);
              }}
              className={cn(
                "animate-in fade-in duration-(--motion-duration-fast)",
                "gap-2",
                isMobile && "py-3 text-base",
              )}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.value === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{item.label}</span>
            </CommandItem>
          ))}
        </CommandList>
      )}
      {footer}
    </Command>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="flex h-[75dvh] flex-col overflow-hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-1 pb-[env(safe-area-inset-bottom)]">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {body}
      </PopoverContent>
    </Popover>
  );
}
