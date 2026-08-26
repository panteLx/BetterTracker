"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  banned: boolean;
  hasPassword: boolean;
  canAccessTrackers: boolean;
  canAccessCases: boolean;
};

const MIN_PASSWORD_LENGTH = 8;

export function AdminUsersClient({ currentRole, currentUserId }: { currentRole: string; currentUserId: string }) {
  const t = useTranslations("Admin.users");
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);

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
      toast.success(t("toasts.updated"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.updateError"));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      fetchJson(`/api/admin/users/${id}/password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => {
      toast.success(t("toasts.passwordReset"));
      setPasswordTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.passwordResetError"));
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ban" | "unban" }) =>
      fetchJson(`/api/admin/users/${id}/${action}`, {
        method: "POST",
        body: action === "ban" ? JSON.stringify({ reason: "Ban through admin panel" }) : undefined,
      }),
    onSuccess: () => {
      toast.success(t("toasts.statusUpdated"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.statusError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      toast.success(t("toasts.deleted"));
      queryClient.setQueryData<{ items: AdminUser[] } | undefined>(
        ["admin-users"],
        (current) =>
          current
            ? { items: current.items.filter((u) => u.id !== id) }
            : current,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toasts.deleteError"));
    },
  });

  function handleDelete(item: AdminUser) {
    if (
      window.confirm(
        t("deleteConfirm", { name: item.name, email: item.email }),
      )
    ) {
      deleteMutation.mutate(item.id);
    }
  }

  function canEditUser(item: AdminUser) {
    if (currentRole === "superadmin") return true;
    return currentRole === "admin" && item.role === "user";
  }

  function canDeleteUser(item: AdminUser) {
    return currentRole === "superadmin" && item.id !== currentUserId && item.role !== "superadmin";
  }

  function hasAnyAction(item: AdminUser) {
    return canEditUser(item) || currentRole === "superadmin";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.email")}</TableHead>
              <TableHead>{t("table.role")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
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
                <TableCell>{item.banned ? t("status.banned") : t("status.active")}</TableCell>
                <TableCell className="text-right">
                  {hasAnyAction(item) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="ml-auto">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t("actions.menu")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditUser(item) ? (
                          <DropdownMenuItem onClick={() => setEditTarget(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("actions.edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {canEditUser(item) && item.hasPassword ? (
                          <DropdownMenuItem onClick={() => setPasswordTarget(item)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            {t("actions.resetPassword")}
                          </DropdownMenuItem>
                        ) : null}
                        {currentRole === "superadmin" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              banMutation.mutate({
                                id: item.id,
                                action: item.banned ? "unban" : "ban",
                              })
                            }
                            disabled={banMutation.isPending}
                          >
                            {item.banned ? (
                              <ShieldCheck className="mr-2 h-4 w-4" />
                            ) : (
                              <ShieldBan className="mr-2 h-4 w-4" />
                            )}
                            {item.banned ? t("actions.unban") : t("actions.ban")}
                          </DropdownMenuItem>
                        ) : null}
                        {currentRole === "superadmin" && item.id !== currentUserId ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              disabled={!canDeleteUser(item) || deleteMutation.isPending}
                              title={
                                item.role === "superadmin"
                                  ? t("actions.deleteSuperadminHint")
                                  : undefined
                              }
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("actions.delete")}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <EditUserDialog
        key={editTarget?.id ?? "edit-none"}
        user={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSave={(payload) => {
          if (editTarget) patchMutation.mutate({ id: editTarget.id, payload });
        }}
        isPending={patchMutation.isPending}
      />

      <ResetPasswordDialog
        key={passwordTarget?.id ?? "password-none"}
        user={passwordTarget}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        onSave={(newPassword) => {
          if (passwordTarget) passwordMutation.mutate({ id: passwordTarget.id, newPassword });
        }}
        isPending={passwordMutation.isPending}
      />
    </Card>
  );
}

function EditUserDialog({
  user,
  onOpenChange,
  onSave,
  isPending,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    name: string;
    email: string;
    canAccessTrackers: boolean;
    canAccessCases: boolean;
  }) => void;
  isPending: boolean;
}) {
  const t = useTranslations("Admin.users.editDialog");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [canAccessTrackers, setCanAccessTrackers] = useState(user?.canAccessTrackers ?? true);
  const [canAccessCases, setCanAccessCases] = useState(user?.canAccessCases ?? true);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({ name: name.trim(), email: email.trim(), canAccessTrackers, canAccessCases });
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-name">{t("name")}</Label>
            <Input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-email">{t("email")}</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-user-access-trackers">{t("access.trackersTitle")}</Label>
                <p className="text-xs text-muted-foreground">{t("access.trackersDescription")}</p>
              </div>
              <Switch
                id="edit-user-access-trackers"
                checked={canAccessTrackers}
                onCheckedChange={setCanAccessTrackers}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-user-access-cases">{t("access.casesTitle")}</Label>
                <p className="text-xs text-muted-foreground">{t("access.casesDescription")}</p>
              </div>
              <Switch
                id="edit-user-access-cases"
                checked={canAccessCases}
                onCheckedChange={setCanAccessCases}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onOpenChange,
  onSave,
  isPending,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onSave: (newPassword: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations("Admin.users.resetPasswordDialog");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(t("tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("mismatch"));
      return;
    }
    onSave(newPassword);
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: user?.name ?? "" })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-new">{t("newPassword")}</Label>
            <Input
              id="reset-password-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-confirm">{t("confirmPassword")}</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
