import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/auth/access-control";
import { env } from "@/lib/env";
import { handleFirstUserPromotion } from "@/lib/auth/first-user";

export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: {
    fallback: env.authUrl,
    allowedHosts: env.authAllowedHosts,
    protocol: "http",
  },
  basePath: "/api/auth",
  trustedOrigins: env.authTrustedOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !env.allowUserRegistration,
  },
  plugins: [
    admin({
      defaultRole: "user",
      ac,
      roles,
    }),
  ],
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
    deleteUser: {
      enabled: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          if (!env.allowUserRegistration) {
            throw new Error("Registration is currently disabled.");
          }
        },
        after: async (createdUser) => {
          if (createdUser?.id) {
            await handleFirstUserPromotion(createdUser.id);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type AuthUser = typeof auth.$Infer.Session.user;
