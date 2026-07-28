import Link from "next/link";
import { CreditCard } from "lucide-react";
import { AuthRedirectAlert } from "@/components/auth/auth-redirect-alert";
import { LoginForm } from "@/components/auth/login-form";
import { oidcDisplayName, oidcEnabled } from "@/lib/auth/oidc";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    error_description?: string | string[];
  }>;
};

function getFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
            Behalte den Überblick<br />über deine Finanzen.
          </h1>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Erfasse Ausgaben und Einnahmen, analysiere Trends und plane mit Terminen — alles in einem Ort.
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
            <h2 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h2>
            <p className="text-sm text-muted-foreground">
              Melde dich an, um fortzufahren.
            </p>
          </div>

          <AuthRedirectAlert
            error={error}
            errorDescription={errorDescription}
            registrationEnabled={registrationEnabled}
            variant="login"
          />

          <LoginForm
            oidcEnabled={oidcEnabled}
            oidcProviderName={oidcDisplayName}
          />

          {registrationEnabled ? (
            <p className="text-center text-sm text-muted-foreground">
              Noch kein Konto?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Jetzt registrieren
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
