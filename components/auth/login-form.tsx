"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/client";
import { OidcButton } from "@/components/auth/oidc-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type LoginFormProps = {
  oidcEnabled?: boolean;
  oidcProviderName?: string;
};

export function LoginForm({
  oidcEnabled = false,
  oidcProviderName,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message || "Login failed");
      }
      toast.success("Login erfolgreich");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full border-border/60">
      <CardContent className="pt-6">
        {oidcEnabled ? (
          <div className="mb-6 space-y-4">
            <OidcButton mode="login" providerName={oidcProviderName} />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  oder mit E-Mail und Passwort
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button className="w-full" disabled={isLoading}>
            {isLoading ? "Bitte warten..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
