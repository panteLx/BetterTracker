import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AppHeader } from "@/components/layout/app-header";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";

export default async function RegisterPage() {
  const registrationEnabled = await getRegistrationEnabled();

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
        {registrationEnabled ? (
          <RegisterForm />
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
