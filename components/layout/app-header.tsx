import Link from "next/link";
import { CreditCard, ReceiptText, Shield, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

type HeaderProps = {
  user?: {
    name: string;
    email: string;
    role?: string | null;
  } | null;
  registrationEnabled?: boolean;
};

export function AppHeader({ user, registrationEnabled = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            BetterTracker
          </span>
        </Link>

        {user ? (
          <nav className="hidden items-center gap-0.5 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <CreditCard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/transactions">
                <ReceiptText className="h-4 w-4" />
                Transaktionen
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/schedules">
                <TimerReset className="h-4 w-4" />
                Termine
              </Link>
            </Button>
            {user.role === "admin" || user.role === "superadmin" ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin">
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu name={user.name} email={user.email} role={user.role} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              {registrationEnabled ? (
                <Button size="sm" asChild>
                  <Link href="/register">Registrieren</Link>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
