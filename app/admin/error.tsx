"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-8 sm:px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-expense/30 bg-expense-muted/50">
        <AlertTriangle className="h-5 w-5 text-expense" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-semibold">Admin-Fehler</p>
        <p className="text-sm text-muted-foreground">
          {error.message || "Ein Fehler ist im Admin-Bereich aufgetreten."}
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Erneut versuchen
      </Button>
    </div>
  );
}
