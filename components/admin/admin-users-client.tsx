"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  banned: boolean;
};

export function AdminUsersClient({ currentRole, currentUserId }: { currentRole: string; currentUserId: string }) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson<{ items: AdminUser[] }>("/api/admin/users"),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      fetchJson(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Benutzer aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen");
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ban" | "unban" }) =>
      fetchJson(`/api/admin/users/${id}/${action}`, {
        method: "POST",
        body: action === "ban" ? JSON.stringify({ reason: "Ban through admin panel" }) : undefined,
      }),
    onSuccess: () => {
      toast.success("Status aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      toast.success("Benutzer gelöscht");
      queryClient.setQueryData<{ items: AdminUser[] } | undefined>(
        ["admin-users"],
        (current) =>
          current
            ? { items: current.items.filter((u) => u.id !== id) }
            : current,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen");
    },
  });

  function handleDelete(item: AdminUser) {
    if (
      window.confirm(
        `Benutzer "${item.name}" (${item.email}) wirklich löschen?\n\nAlle Buchungen, Schedules und Tracker-Mitgliedschaften dieses Benutzers werden unwiderruflich gelöscht.`,
      )
    ) {
      deleteMutation.mutate(item.id);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benutzerverwaltung</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(usersQuery.data?.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>
                  {currentRole === "superadmin" ? (
                    <Select
                      value={item.role}
                      onValueChange={(value) =>
                        patchMutation.mutate({ id: item.id, payload: { role: value } })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">user</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="superadmin">superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    item.role
                  )}
                </TableCell>
                <TableCell>{item.banned ? "Gesperrt" : "Aktiv"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {currentRole === "superadmin" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          banMutation.mutate({
                            id: item.id,
                            action: item.banned ? "unban" : "ban",
                          })
                        }
                        disabled={banMutation.isPending}
                      >
                        {item.banned ? "Entsperren" : "Sperren"}
                      </Button>
                    ) : null}
                    {currentRole === "superadmin" && item.id !== currentUserId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(item)}
                        disabled={deleteMutation.isPending}
                      >
                        Löschen
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
