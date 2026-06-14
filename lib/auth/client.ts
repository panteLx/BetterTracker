"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, genericOAuthClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/auth/access-control";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "",
  plugins: [
    genericOAuthClient(),
    adminClient({
      ac,
      roles,
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
