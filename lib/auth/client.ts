"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, genericOAuthClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/auth/access-control";

// No baseURL: better-auth resolves it from window.location.origin in the
// browser, which is all this client ever runs in (auth calls only happen
// from event handlers, never during SSR).
export const authClient = createAuthClient({
  plugins: [
    genericOAuthClient(),
    adminClient({
      ac,
      roles,
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
