import Link from "next/link";
import { AuthRedirectAlert } from "@/components/auth/auth-redirect-alert";
import { RegisterForm } from "@/components/auth/register-form";
import { AppHeader } from "@/components/layout/app-header";
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

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const registrationEnabled = await getRegistrationEnabled();
  const query = await searchParams;
  const error = getFirstValue(query.error);
  const errorDescription = getFirstValue(query.error_description);

  return (
    <div className="min-h-screen">
      <AppHeader registrationEnabled={registrationEnabled} />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">
            Registrieren
          </h1>
          <p className="text-sm text-muted-foreground">
            Registriere dich, um Zugriff auf die Funktionen der App zu erhalten.
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
          <p className="text-center text-sm text-muted-foreground">
            Registrierungen sind aktuell deaktiviert.
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Bereits registriert?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Zum Login
          </Link>
        </p>
      </main>
    </div>
  );
}
