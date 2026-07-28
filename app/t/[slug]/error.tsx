"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PublicTrackerError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-expense/30 bg-expense-muted/50">
        <AlertTriangle className="h-5 w-5 text-expense" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-semibold">Tracker nicht erreichbar</p>
        <p className="text-sm text-muted-foreground">
          {error.message || "Dieser Tracker konnte nicht geladen werden."}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Zum Login</Link>
      </Button>
    </div>
  );
}
