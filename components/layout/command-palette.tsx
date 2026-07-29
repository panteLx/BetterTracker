"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, CreditCard, ReceiptText, Search, Settings, TimerReset, User } from "lucide-react";
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

const routes = [
  { href: "/", label: "Dashboard", icon: CreditCard },
  { href: "/transactions", label: "Transaktionen", icon: ReceiptText },
  { href: "/schedules", label: "Termine", icon: TimerReset },
  { href: "/statistics", label: "Statistiken", icon: BarChart2 },
  { href: "/profile", label: "Profil", icon: User },
];

export function CommandPalette({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
        aria-label="Befehlspalette öffnen"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Suche</span>
        <kbd className="pointer-events-none ml-1 hidden select-none rounded border border-border bg-muted px-1 text-[10px] font-mono font-medium sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Seite oder Aktion suchen…" />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {routes.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => navigate(href)}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          {isAdmin ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Einstellungen">
                <CommandItem onSelect={() => navigate("/admin")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Admin-Bereich
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
