"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signUp } from "@/lib/auth/client";
import { OidcButton } from "@/components/auth/oidc-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type RegisterFormProps = {
  oidcEnabled?: boolean;
  oidcProviderName?: string;
};

export function RegisterForm({
  oidcEnabled = false,
  oidcProviderName,
}: RegisterFormProps) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        throw new Error(result.error.message || "Registration failed");
      }
      toast.success(t("register.form.successToast"));
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("register.form.errorToast")
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("register.form.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {oidcEnabled ? (
          <div className="mb-6 space-y-4">
            <OidcButton mode="register" providerName={oidcProviderName} />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("register.form.orDivider")}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("register.form.nameLabel")}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("register.form.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("register.form.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button className="w-full" disabled={isLoading}>
            {isLoading ? t("register.form.submitLoading") : t("register.form.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
