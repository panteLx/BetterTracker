import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type AuthRedirectAlertProps = {
  error?: string;
  errorDescription?: string;
  registrationEnabled: boolean;
  variant: "login" | "register";
};

type AlertContent = {
  title: string;
  description?: string;
  linkHref?: string;
  linkLabel?: string;
};

function getAlertContent(
  {
    error,
    errorDescription,
    registrationEnabled,
    variant,
  }: AuthRedirectAlertProps,
  t: Awaited<ReturnType<typeof getTranslations>>
): AlertContent | null {
  if (!error) {
    return null;
  }

  switch (error) {
    case "BANNED_USER":
      return {
        title: t("redirectAlert.banned.title"),
        description: t("redirectAlert.banned.description"),
      };
    case "signup_disabled":
      if (variant === "login" && registrationEnabled) {
        return {
          title: t("redirectAlert.accountNotFound.title"),
          description: t("redirectAlert.accountNotFound.description"),
          linkHref: "/register",
          linkLabel: t("redirectAlert.accountNotFound.linkLabel"),
        };
      }

      return {
        title: t("redirectAlert.registrationDisabled.title"),
        description: t("redirectAlert.registrationDisabled.description"),
      };
    case "access_denied":
      return {
        title: t("redirectAlert.accessDenied.title"),
      };
    case "email_is_missing":
      return {
        title: t("redirectAlert.emailMissing.title"),
        description: t("redirectAlert.emailMissing.description"),
      };
    case "oauth_code_verification_failed":
      return {
        title: t("redirectAlert.oidcVerificationFailed.title"),
        description: t("redirectAlert.oidcVerificationFailed.description"),
      };
    default:
      return {
        title: t("redirectAlert.default.title"),
        description: errorDescription || error,
      };
  }
}

export async function AuthRedirectAlert(props: AuthRedirectAlertProps) {
  const t = await getTranslations("Auth");
  const content = getAlertContent(props, t);

  if (!content) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mx-auto w-full max-w-md">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>
        {content.description ? <p>{content.description}</p> : null}
        {content.linkHref && content.linkLabel ? (
          <p className="mt-2">
            <Link href={content.linkHref} className="font-medium underline">
              {content.linkLabel}
            </Link>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
