"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OIDC_DISPLAY_NAME,
  OIDC_PROVIDER_ID,
} from "@/lib/auth/oidc-constants";
import { toast } from "sonner";

type OidcButtonProps = {
  mode: "login" | "register";
  providerName?: string;
};

export function OidcButton({
  mode,
  providerName = DEFAULT_OIDC_DISPLAY_NAME,
}: OidcButtonProps) {
  const t = useTranslations("Auth");
  const [isLoading, setIsLoading] = useState(false);

  async function onClick() {
    setIsLoading(true);

    try {
      const result = await signIn.oauth2({
        providerId: OIDC_PROVIDER_ID,
        callbackURL: "/",
        errorCallbackURL: mode === "login" ? "/login" : "/register",
        ...(mode === "register"
          ? {
              requestSignUp: true,
              newUserCallbackURL: "/",
            }
          : {}),
      });

      if (result.error) {
        throw new Error(result.error.message || "OIDC authentication failed");
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(
        error instanceof Error ? error.message : t("oidc.errorToast")
      );
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={onClick}
      disabled={isLoading}
    >
      <LogIn className="h-4 w-4" />
      {isLoading
        ? t("oidc.redirecting")
        : mode === "login"
          ? t("oidc.loginWith", { provider: providerName })
          : t("oidc.registerWith", { provider: providerName })}
    </Button>
  );
}
