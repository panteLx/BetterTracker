"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDateTime } from "@/lib/utils";

type LogItem = {
  id: string;
  actorUserId: string | null;
  actorUserName: string | null;
  actorUserEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  severity: "info" | "warning" | "error" | "critical";
  metadataJson: string | null;
  ipAddress: string | null;
  createdAt: string | number;
};

type AdminLogsClientProps = {
  locale: string;
  timezone: string;
  currentRole: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-info-muted text-info",
  warning: "bg-warning-muted text-warning-foreground",
  error: "bg-expense-muted text-expense",
  critical: "bg-expense-muted text-expense font-semibold",
};

const SEVERITY_ALL = "all";

function MetadataCell({ json }: { json: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!json || json === "null") return <span className="text-muted-foreground">—</span>;

  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    pretty = json;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {expanded ? "Einklappen" : "Anzeigen"}
      </button>
      {expanded ? (
        <pre className="mt-1 max-h-48 max-w-xs overflow-auto rounded-md bg-muted p-2 text-xs">
          {pretty}
        </pre>
      ) : null}
    </div>
  );
}

export function AdminLogsClient({ locale, timezone, currentRole }: AdminLogsClientProps) {
  const queryClient = useQueryClient();
  const [actionFilter, setActionFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState(SEVERITY_ALL);
  const [actorFilter, setActorFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const params = new URLSearchParams();
  if (actionFilter.trim()) params.set("action", actionFilter.trim());
  if (severityFilter !== SEVERITY_ALL) params.set("severity", severityFilter);
  if (actorFilter.trim()) params.set("actor", actorFilter.trim());
  if (fromFilter) params.set("from", fromFilter);
  if (toFilter) params.set("to", toFilter);
  const queryString = params.toString();

  const logsQuery = useQuery({
    queryKey: ["admin-logs", queryString],
    queryFn: () =>
      fetchJson<{ items: LogItem[] }>(
        `/api/admin/logs${queryString ? `?${queryString}` : ""}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/logs", { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Alle Logs gelöscht");
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen"),
  });

  function handleDeleteAll() {
    if (window.confirm("Wirklich alle Audit-Logs unwiderruflich löschen?")) {
      deleteMutation.mutate();
    }
  }

  const items = logsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Aktion</Label>
            <Input
              placeholder="z. B. transaction_created"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Akteur (E-Mail)</Label>
            <Input
              placeholder="user@example.com"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEVERITY_ALL}>Alle</SelectItem>
                <SelectItem value="info">info</SelectItem>
                <SelectItem value="warning">warning</SelectItem>
                <SelectItem value="error">error</SelectItem>
                <SelectItem value="critical">critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <DatePicker value={fromFilter} onChange={setFromFilter} placeholder="Von" />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <DatePicker value={toFilter} onChange={setToFilter} placeholder="Bis" />
            </div>
          </div>
        </div>
      </div>

      {/* Table header row */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {logsQuery.isPending
            ? "Lädt…"
            : `${items.length} Einträge${items.length === 500 ? " (Limit)" : ""}`}
        </p>
        {currentRole === "superadmin" ? (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDeleteAll}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Alle löschen
          </Button>
        ) : null}
      </div>

      {/* Log entries */}
      <div className="rounded-xl border border-border/60 bg-card">
        {items.length === 0 && !logsQuery.isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Logs gefunden.
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((item) => (
              <div key={item.id} className="grid gap-y-1 px-4 py-3 text-sm sm:grid-cols-[180px_1fr]">
                {/* Left: time + severity */}
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt, locale, timezone)}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs ${SEVERITY_COLORS[item.severity] ?? ""}`}
                  >
                    {item.severity}
                  </span>
                </div>

                {/* Right: details */}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{item.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.resourceType}
                      {item.resourceId ? ` · ${item.resourceId.slice(0, 8)}…` : ""}
                    </span>
                  </div>
                  {item.actorUserName || item.actorUserEmail ? (
                    <p className="text-xs text-muted-foreground">
                      {item.actorUserName}
                      {item.actorUserEmail ? ` (${item.actorUserEmail})` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">System</p>
                  )}
                  {item.ipAddress ? (
                    <p className="font-mono text-xs text-muted-foreground">{item.ipAddress}</p>
                  ) : null}
                  <MetadataCell json={item.metadataJson} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
