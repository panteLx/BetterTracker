import Link from "next/link";
import { AuthRedirectAlert } from "@/components/auth/auth-redirect-alert";
import { LoginForm } from "@/components/auth/login-form";
import { AppHeader } from "@/components/layout/app-header";
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
    <div className="min-h-screen">
      <AppHeader registrationEnabled={registrationEnabled} />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Melde dich an, um Zugriff auf die Funktionen der App zu erhalten.
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
      </main>
    </div>
  );
}
