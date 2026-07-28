import Link from "next/link";
import { CreditCard } from "lucide-react";
import { AuthRedirectAlert } from "@/components/auth/auth-redirect-alert";
import { RegisterForm } from "@/components/auth/register-form";
import { oidcDisplayName, oidcEnabled } from "@/lib/auth/oidc";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    error_description?: string | string[];
  }>;
};

function getFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const registrationEnabled = await getRegistrationEnabled();
  const query = await searchParams;
  const error = getFirstValue(query.error);
  const errorDescription = getFirstValue(query.error_description);

  return (
    <div className="min-h-screen flex">
      {/* Brand Panel */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-between bg-gradient-to-br from-primary/90 to-primary p-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">BetterTracker</span>
        </Link>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-white tracking-tight leading-snug">
            Starte noch heute<br />mit deiner Finanzverwaltung.
          </h1>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Erstelle ein kostenloses Konto und behalte mit BetterTracker den Überblick über deine Ausgaben und Einnahmen.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          Self-hosted · Open Source · Datenschutzfreundlich
        </p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand */}
          <div className="flex flex-col items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">BetterTracker</h1>
          </div>

          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">Konto erstellen</h2>
            <p className="text-sm text-muted-foreground">
              Registriere dich, um zu starten.
            </p>
          </div>

          <AuthRedirectAlert
            error={error}
            errorDescription={errorDescription}
            registrationEnabled={registrationEnabled}
            variant="register"
          />

          {registrationEnabled ? (
            <RegisterForm
              oidcEnabled={oidcEnabled}
              oidcProviderName={oidcDisplayName}
            />
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Registrierungen sind aktuell deaktiviert.
              </p>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Bereits registriert?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Zum Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
