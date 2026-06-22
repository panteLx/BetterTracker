"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SearchableSelectItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: SearchableSelectItem[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
};

export function SearchableSelect({
  value,
  onValueChange,
  items,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedItem = items.find((item) => item.value === value);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) =>
      item.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [items, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2">
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="max-h-60 overflow-y-auto">
            {filteredItems.length > 0 ? (
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const isSelected = item.value === value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition",
                        item.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                      disabled={item.disabled}
                      onClick={() => {
                        onValueChange(item.value);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
