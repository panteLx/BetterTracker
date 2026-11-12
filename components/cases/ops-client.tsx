"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, CircleAlert, CircleCheck, Copy, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { OpsAdminPanel } from "@/components/cases/ops-admin-panel";
import { fetchJson } from "@/lib/client-fetch";
import { getAopEligibility } from "@/lib/ops/aop-rule";
import { cn, formatDateTime } from "@/lib/utils";

export type OpsFixedCodes = {
  letterPost: string;
  letterFax: string;
  flatUnder60: string;
  flatFrom60: string;
};

type DatasetFile = { fileName: string; uploadedAt: string; rowCount: number };
export type OpsDataset = { anhang2: DatasetFile | null; hybrid: DatasetFile | null };

type OpsResult = {
  opsCode: string;
  description: string;
  operation: string | null;
  monitoring: string | null;
  anesthesia: string | null;
  funding: string | null;
  hygiene: string | null;
  aop115b: boolean;
  hybridDrg: boolean;
};

type OpsResponse = {
  items: OpsResult[];
  total: number;
  fixedCodes: OpsFixedCodes;
  dataset: OpsDataset;
};

function CodeRow({
  label,
  value,
  blocked,
}: {
  label: string;
  value: string | null;
  blocked: boolean;
}) {
  const t = useTranslations("Cases.ops");
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context); the code stays selectable.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums select-text">
          {value ?? t("fields.none")}
        </span>
        {value && !blocked ? (
          <button
            type="button"
            onClick={copy}
            aria-label={t("copyAria", { value })}
            title={copied ? t("copied") : t("copy")}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function CodeGroup({
  title,
  blocked,
  children,
}: {
  title: string;
  blocked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div aria-disabled={blocked || undefined} className={cn(blocked && "opacity-45")}>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ResultDetail({
  item,
  fixedCodes,
  hybridListMissing,
}: {
  item: OpsResult;
  fixedCodes: OpsFixedCodes;
  hybridListMissing: boolean;
}) {
  const t = useTranslations("Cases.ops");
  const eligibility = getAopEligibility({ aop115b: item.aop115b, hybridDrg: item.hybridDrg });
  const blocked = !eligibility.allowed;
  const yesNo = (v: boolean) => (v ? t("fields.yes") : t("fields.no"));

  return (
    <SectionCard>
      <div className="space-y-5">
        <div>
          <div className="font-mono text-3xl font-bold tracking-tight text-primary">{item.opsCode}</div>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>

        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3",
            blocked
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          )}
        >
          {blocked ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />}
          <div className="space-y-1">
            <div className="font-semibold">{blocked ? t("aop.blocked") : t("aop.allowed")}</div>
            {eligibility.reasons.map((reason) => (
              <div key={reason} className="text-sm">
                {t(`aop.reason.${reason}`)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={item.aop115b ? "secondary" : "destructive"}>
            {t("fields.aop115b")}: {yesNo(item.aop115b)}
          </Badge>
          <Badge variant={item.hybridDrg ? "destructive" : "secondary"}>
            {t("fields.hybrid")}: {yesNo(item.hybridDrg)}
          </Badge>
        </div>
        {hybridListMissing ? <p className="text-xs text-muted-foreground">{t("noHybridList")}</p> : null}

        <CodeGroup title={t("groups.billing")} blocked={blocked}>
          <CodeRow label={t("fields.operation")} value={item.operation} blocked={blocked} />
          <CodeRow label={t("fields.monitoring")} value={item.monitoring} blocked={blocked} />
          <CodeRow label={t("fields.funding")} value={item.funding} blocked={blocked} />
          <CodeRow label={t("fields.hygiene")} value={item.hygiene} blocked={blocked} />
        </CodeGroup>
        <CodeGroup title={t("groups.letters")} blocked={blocked}>
          <CodeRow label={t("fields.letterPost")} value={fixedCodes.letterPost} blocked={blocked} />
          <CodeRow label={t("fields.letterFax")} value={fixedCodes.letterFax} blocked={blocked} />
          <CodeRow label={t("fields.flatUnder60")} value={fixedCodes.flatUnder60} blocked={blocked} />
          <CodeRow label={t("fields.flatFrom60")} value={fixedCodes.flatFrom60} blocked={blocked} />
        </CodeGroup>
        <CodeGroup title={t("groups.anesthesia")} blocked={blocked}>
          <CodeRow label={t("fields.anesthesia")} value={item.anesthesia} blocked={blocked} />
        </CodeGroup>
      </div>
    </SectionCard>
  );
}

export function OpsClient({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("Cases.ops");
  const locale = useLocale();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(id);
  }, [input]);

  const { data } = useQuery({
    queryKey: ["ops", query],
    queryFn: () => fetchJson<OpsResponse>(`/api/ops?q=${encodeURIComponent(query)}`),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const current = items.find((i) => i.opsCode === selected) ?? items[0] ?? null;
  const dataset = data?.dataset;
  const hasData = Boolean(dataset?.anhang2);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {dataset ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {(["anhang2", "hybrid"] as const).map((kind) => {
            const f = dataset[kind];
            return (
              <span key={kind}>
                <span className="font-medium">{t(`dataset.${kind}`)}: </span>
                {f
                  ? t("dataset.info", {
                      file: f.fileName,
                      rows: f.rowCount,
                      date: formatDateTime(f.uploadedAt, locale),
                    })
                  : t("dataset.none")}
              </span>
            );
          })}
        </div>
      ) : null}

      {!hasData ? (
        <EmptyState icon={Search} title={t("noData.title")} description={t("noData.description")} />
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              autoComplete="off"
              className="h-12 pl-10 text-base"
            />
          </div>

          {query === "" ? (
            <EmptyState icon={Search} title={t("emptyPrompt.title")} description={t("emptyPrompt.description")} />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("resultCount", { shown: items.length, total: data?.total ?? items.length })}
                </p>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <button
                      key={item.opsCode}
                      type="button"
                      aria-pressed={item.opsCode === current?.opsCode}
                      onClick={() => setSelected(item.opsCode)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted",
                        item.opsCode === current?.opsCode && "border-primary bg-primary-subtle"
                      )}
                    >
                      <span className="font-mono text-sm font-semibold">{item.opsCode}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              {current && data ? (
                <div className="min-w-0">
                  <ResultDetail
                    item={current}
                    fixedCodes={data.fixedCodes}
                    hybridListMissing={!dataset?.hybrid}
                  />
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {isAdmin && data ? <OpsAdminPanel key={JSON.stringify(data.fixedCodes)} fixedCodes={data.fixedCodes} /> : null}
    </div>
  );
}
