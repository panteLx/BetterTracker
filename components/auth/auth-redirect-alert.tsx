import Link from "next/link";
import { AlertCircle } from "lucide-react";
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

function getAlertContent({
  error,
  errorDescription,
  registrationEnabled,
  variant,
}: AuthRedirectAlertProps): AlertContent | null {
  if (!error) {
    return null;
  }

  switch (error) {
    case "BANNED_USER":
      return {
        title: "Dein Konto wurde gesperrt.",
        description:
          "Bitte kontaktiere einen Administrator, wenn das ein Fehler sein sollte.",
      };
    case "signup_disabled":
      if (variant === "login" && registrationEnabled) {
        return {
          title: "Dieses Konto existiert noch nicht.",
          description:
            "Bitte registriere dich zuerst und versuche die Anmeldung danach erneut.",
          linkHref: "/register",
          linkLabel: "Zur Registrierung",
        };
      }

      return {
        title: "Registrierungen sind aktuell deaktiviert.",
        description:
          "Ein neues Konto kann derzeit nicht erstellt werden. Bitte wende dich an einen Administrator.",
      };
    case "access_denied":
      return {
        title: "Die Anmeldung wurde beim Identity-Provider abgebrochen.",
      };
    case "email_is_missing":
      return {
        title: "Der Identity-Provider hat keine E-Mail-Adresse geliefert.",
        description:
          "Bitte verwende einen Account mit freigegebener E-Mail-Adresse oder passe die OIDC-Konfiguration an.",
      };
    case "oauth_code_verification_failed":
      return {
        title: "Die OIDC-Anmeldung konnte nicht abgeschlossen werden.",
        description:
          "Bitte versuche es erneut. Wenn der Fehler bleibt, pruefe die OIDC-Konfiguration.",
      };
    default:
      return {
        title: "Die Anmeldung konnte nicht abgeschlossen werden.",
        description: errorDescription || error,
      };
  }
}

export function AuthRedirectAlert(props: AuthRedirectAlertProps) {
  const content = getAlertContent(props);

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
