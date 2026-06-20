import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  PiggyBank,
  Shield,
  TimerReset,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LandingPageProps = {
  registrationEnabled: boolean;
};

export function LandingPage({ registrationEnabled }: LandingPageProps) {
  return (
    <div className="min-h-screen">
      <AppHeader registrationEnabled={registrationEnabled} />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="grid gap-8 rounded-[2rem] border border-border/50 bg-card/80 p-8 shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Dein gemeinsamer Ausgaben-Tracker
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Behalte Haushaltsgeld, Urlaubskasse und gemeinsame Ausgaben an
                einem Ort im Blick.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                BetterTracker hilft dir beim Erfassen von Einnahmen und
                Ausgaben, bei wiederkehrenden Zahlungen und beim Aufteilen in
                eigene Tracker für Alltag, Reisen oder Projekte.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {registrationEnabled ? (
                <Button size="lg" asChild>
                  <Link href="/register">
                    Jetzt starten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
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
                  Schnelle Buchungen
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Neue Ausgaben und Einnahmen sind in wenigen Sekunden erfasst und
                sofort in der Uebersicht sichtbar.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TimerReset className="h-5 w-5 text-primary" />
                  Wiederkehrende Zahlungen
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Miete, Abos oder Gehalt lassen sich als wiederkehrende Eintraege
                vorbereiten.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  Mehrere Bereiche
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Lege separate Tracker für Haushalt, Urlaub, WG oder
                Nebenkosten an und halte alles sauber getrennt.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Gemeinsam nutzbar
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Mehrere Nutzer koennen mitarbeiten, waehrend Admins den Zugriff
                zentral verwalten.
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
