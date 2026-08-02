import { Megaphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SiteMessageBannerProps = {
  message: string | null;
  className?: string;
};

export function SiteMessageBanner({ message, className }: SiteMessageBannerProps) {
  if (!message) return null;

  return (
    <Alert className={className}>
      <Megaphone className="h-4 w-4" />
      <AlertDescription>
        <p className="whitespace-pre-wrap">{message}</p>
      </AlertDescription>
    </Alert>
  );
}
