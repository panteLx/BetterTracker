"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, FolderClock } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { BatchesClient } from "@/components/cases/batches-client";
import { InvoicesClient } from "@/components/cases/invoices-client";

type Tab = "batches" | "invoices";

export function SubmissionsClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("Cases.submissions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "invoices" ? "invoices" : "batches";

  function changeTab(next: Tab) {
    router.replace(next === "batches" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <Segmented<Tab>
          variant="track"
          size="sm"
          label={t("title")}
          value={tab}
          onValueChange={changeTab}
          items={[
            { value: "batches", label: t("tabs.batches"), icon: FolderClock },
            { value: "invoices", label: t("tabs.invoices"), icon: FileText },
          ]}
        />
      </div>
      {tab === "batches" ? (
        <BatchesClient workspaceId={workspaceId} />
      ) : (
        <InvoicesClient workspaceId={workspaceId} />
      )}
    </div>
  );
}
