import Link from "next/link";
import { CreditCard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
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
  const t = await getTranslations("Auth");
  const registrationEnabled = await getRegistrationEnabled();
  const query = await searchParams;
  const error = getFirstValue(query.error);
  const errorDescription = getFirstValue(query.error_description);

  return (
    <div className="min-h-screen flex">
      {/* Brand Panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-canvas p-12 text-brand-canvas-foreground md:flex md:w-1/2">
        {/* A single wash of the chosen accent, so the panel picks up the
            accent setting without becoming a colored slab. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 60% at 15% 0%, var(--primary), transparent 70%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <CreditCard className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">BetterTracker</span>
        </Link>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            {t("register.page.heroTitleLine1")}
            <br />
            {t("register.page.heroTitleLine2")}
          </h1>
          <p className="max-w-sm font-subtext text-sm leading-relaxed text-brand-canvas-foreground/70">
            {t("register.page.heroSubtext")}
          </p>
        </div>
        <p className="relative font-subtext text-xs text-brand-canvas-foreground/50">
          {t("register.page.tagline")}
        </p>
      </div>

      {/* Form Panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-5 top-5">
          <ThemeToggleButton />
        </div>
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand */}
          <div className="flex flex-col items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">BetterTracker</h1>
          </div>

          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">{t("register.page.welcomeTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("register.page.welcomeSubtext")}
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
            <div className="rounded-xl border border-border bg-surface-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("register.page.disabledNotice")}
              </p>
            </div>
          )}

          <p className="text-center font-subtext text-sm text-muted-foreground">
            {t("register.page.alreadyRegistered")}{" "}
            <Link href="/login" className="font-medium text-primary-on hover:underline">
              {t("register.page.loginLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
