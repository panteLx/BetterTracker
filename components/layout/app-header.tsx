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
};

export function AppHeader({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BetterTracker
            </Link>
            <p className="text-xs text-muted-foreground">
              Finanzen direkt in Next.js und Drizzle
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/">
              <CreditCard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/transactions">
              <ReceiptText className="mr-2 h-4 w-4" />
              Transaktionen
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/schedules">
              <TimerReset className="mr-2 h-4 w-4" />
              Schedules
            </Link>
          </Button>
          {user?.role === "admin" || user?.role === "superadmin" ? (
            <Button variant="ghost" asChild>
              <Link href="/admin">
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Link>
            </Button>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu name={user.name} email={user.email} role={user.role} />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Registrieren</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
