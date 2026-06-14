import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AppHeader } from "@/components/layout/app-header";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";

export default async function LoginPage() {
  const registrationEnabled = await getRegistrationEnabled();

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
        <LoginForm />
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
