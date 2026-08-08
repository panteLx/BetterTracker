"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  ClipboardList,
  FileStack,
  FolderClock,
  FolderPlus,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/client-fetch";
import { canWriteTracker as canWriteWorkspace } from "@/lib/auth/permissions";

type CaseWorkspace = {
  id: string;
  permission: "owner" | "admin" | "write" | "read";
};

function matchesQuery(label: string, query: string) {
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Cases-module counterpart to the main app's CommandPalette. Actions
 * navigate with a `?new=case` / `?new=workspace` query param rather than
 * opening a sheet directly, since the sheets live in per-page client
 * components (CaseBoardClient / CaseWorkspaceListClient) this header has no
 * direct handle on — the same deep-link approach the main palette already
 * uses to land on a pre-filtered /transactions.
 */
export function CasesCommandPalette({ workspaceId }: { workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Cases.commandPalette");
  const themeT = useTranslations("Nav.theme");

  const workspacesQuery = useQuery({
    queryKey: ["case-workspaces"],
    queryFn: () => fetchJson<{ items: CaseWorkspace[] }>("/api/case-workspaces"),
    enabled: open && Boolean(workspaceId),
  });
  const workspace = workspacesQuery.data?.items.find((item) => item.id === workspaceId);
  const canCreateCaseFile = workspace ? canWriteWorkspace(workspace.permission) : false;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const navItems = [
    { href: "/cases", key: "allWorkspaces" as const, icon: FileStack },
    ...(workspaceId
      ? [
          { href: `/cases/${workspaceId}`, key: "board" as const, icon: ClipboardList },
          { href: `/cases/${workspaceId}/batches`, key: "batches" as const, icon: FolderClock },
          { href: `/cases/${workspaceId}/settings`, key: "settings" as const, icon: Settings },
        ]
      : []),
  ].map((item) => ({ ...item, label: t(`routes.${item.key}`) }));
  const filteredNavItems = navItems.filter((item) => matchesQuery(item.label, search));

  const actions = [
    ...(workspaceId && canCreateCaseFile
      ? [
          {
            key: "new-case-file",
            label: t("newCaseFile"),
            icon: Plus,
            onSelect: () => navigate(`/cases/${workspaceId}?new=case`),
          },
        ]
      : []),
    {
      key: "new-workspace",
      label: t("newWorkspace"),
      icon: FolderPlus,
      onSelect: () => navigate("/cases?new=workspace"),
    },
    {
      key: "toggle-theme",
      label: resolvedTheme === "dark" ? themeT("toLight") : themeT("toDark"),
      icon: resolvedTheme === "dark" ? Sun : Moon,
      onSelect: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setOpen(false);
      },
    },
  ];
  const filteredActions = actions.filter((action) => matchesQuery(action.label, search));

  const nothingFound = filteredNavItems.length === 0 && filteredActions.length === 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
        aria-label={t("openAria")}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">{t("search")}</span>
        <kbd className="pointer-events-none ml-1 hidden select-none rounded border border-border bg-muted px-1 text-[10px] font-mono font-medium sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        shouldFilter={false}
        title={t("title")}
        description={t("description")}
      >
        <CommandInput value={search} onValueChange={setSearch} placeholder={t("placeholder")} />
        <CommandList>
          {nothingFound ? <CommandEmpty>{t("noResults")}</CommandEmpty> : null}

          {filteredNavItems.length > 0 ? (
            <CommandGroup heading={t("groupNavigation")}>
              {filteredNavItems.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} onSelect={() => navigate(href)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {filteredActions.length > 0 ? (
            <>
              {filteredNavItems.length > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={t("groupActions")}>
                {filteredActions.map(({ key, label, icon: Icon, onSelect }) => (
                  <CommandItem key={key} onSelect={onSelect}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
