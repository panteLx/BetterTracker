"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LogItem = {
  id: string;
  action: string;
  resourceType: string;
  severity: string;
  createdAt: string | number;
  metadataJson?: string | null;
};

export function AdminLogsClient() {
  const logsQuery = useQuery({
    queryKey: ["admin-logs"],
    queryFn: () => fetchJson<{ items: LogItem[] }>("/api/admin/logs"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeit</TableHead>
              <TableHead>Aktion</TableHead>
              <TableHead>Ressource</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Metadaten</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logsQuery.data?.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.createdAt).toLocaleString("de-DE")}</TableCell>
                <TableCell>{item.action}</TableCell>
                <TableCell>{item.resourceType}</TableCell>
                <TableCell>{item.severity}</TableCell>
                <TableCell className="max-w-sm truncate">{item.metadataJson || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
