import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AppHeader } from "@/components/layout/app-header";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Melde dich an, um deine Tracker und Admin-Funktionen zu nutzen.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Jetzt registrieren
          </Link>
        </p>
      </main>
    </div>
  );
}
