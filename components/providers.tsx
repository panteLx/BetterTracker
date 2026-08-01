"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { ReactNode, useState } from "react";
import { Toaster } from "sonner";
import type { Locale } from "@/lib/i18n/config";

type Messages = Parameters<typeof NextIntlClientProvider>[0]["messages"];

export function Providers({
  children,
  locale,
  messages,
  timeZone,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
  timeZone: string;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
