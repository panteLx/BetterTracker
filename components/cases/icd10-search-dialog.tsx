"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/client-fetch";

type Icd10Result = { code: string; title: string; groupTitle: string | null };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Standalone lookup tool, not tied to case files — nothing selected here is
 * persisted, it only copies the code to the clipboard for pasting into the
 * hospital's own KIS.
 */
export function Icd10SearchDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const t = useTranslations("Cases.icd10Search");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  }

  const resultsQuery = useQuery({
    queryKey: ["icd10-search", debouncedSearch],
    queryFn: () =>
      fetchJson<{ items: Icd10Result[] }>(`/api/icd10/search?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: open && debouncedSearch.length >= 2,
  });
  const results = resultsQuery.data?.items ?? [];
  const showMinCharsHint = debouncedSearch.length < 2;

  async function copyToClipboard(text: string, toastMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(toastMessage);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function copyCode(code: string) {
    void copyToClipboard(code, t("copiedCode", { code }));
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={t("openAria")}
        title={t("trigger")}
      >
        <Stethoscope className="h-4 w-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        shouldFilter={false}
        title={t("title")}
        description={t("description")}
        className="sm:max-w-2xl"
      >
        <CommandInput value={search} onValueChange={setSearch} placeholder={t("placeholder")} />
        <CommandList>
          {showMinCharsHint ? (
            <CommandEmpty>{t("minChars")}</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>{resultsQuery.isFetching ? "…" : t("noResults")}</CommandEmpty>
          ) : (
            <CommandGroup>
              {results.map((result) => (
                <CommandItem
                  key={result.code}
                  value={result.code}
                  onSelect={() => copyCode(result.code)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono font-semibold text-foreground">{result.code}</span>
                    {result.groupTitle ? <span className="truncate">{result.groupTitle}</span> : null}
                  </div>
                  <span className="text-sm leading-snug break-words">{result.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {t("footnote")}
        </div>
      </CommandDialog>
    </>
  );
}
