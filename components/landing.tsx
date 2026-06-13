import Link from "next/link";
import { ArrowRight, CreditCard, Shield, TimerReset } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="grid gap-8 rounded-[2rem] border border-border/50 bg-card/80 p-8 shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Self-hosted Expense Tracker
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Expenses, Schedules und Admin-Flows direkt in einer Next.js App.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                BetterTracker ersetzt den früheren ActualBudget-Zwischenschritt und
                speichert alles direkt mit Drizzle in SQLite.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  Jetzt starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Zum Login</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Direktes Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Konfigurierbare Tracker statt starrer Coffee/Money-Integrationen.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TimerReset className="h-5 w-5 text-primary" />
                  Schedules mit Create-Flow
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Wiederkehrende Verpflichtungen erzeugen auf Knopfdruck echte Transaktionen.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Rollen und Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Multi-User, Better Auth, Admin-Settings, Audit Logs und Discord-Webhooks.
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
