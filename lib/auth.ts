import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/auth/access-control";
import { env } from "@/lib/env";
import { handleFirstUserPromotion } from "@/lib/auth/first-user";
import { oidcConfig } from "@/lib/auth/oidc";
import { getRegistrationEnabled } from "@/lib/services/admin-settings-service";
import { getAuditContextFromHeaders, logAuditEvent } from "@/lib/audit-log";

const adminPlugin = admin({
  defaultRole: "user",
  ac,
  roles,
});

// A registration always creates a session right after the user row is
// inserted, which would otherwise also fire the session.create hook and log
// a redundant "user_login" alongside "user_registered". This tracks users
// whose account was just created so that immediate follow-up session is
// skipped, regardless of which auth method (credentials or OIDC) created it.
const recentlyRegisteredUserIds = new Map<string, number>();
const REGISTRATION_DEDUPE_WINDOW_MS = 60_000;

function markUserJustRegistered(userId: string) {
  const now = Date.now();
  for (const [id, registeredAt] of recentlyRegisteredUserIds) {
    if (now - registeredAt > REGISTRATION_DEDUPE_WINDOW_MS) {
      recentlyRegisteredUserIds.delete(id);
    }
  }
  recentlyRegisteredUserIds.set(userId, now);
}

function consumeJustRegistered(userId: string) {
  if (!recentlyRegisteredUserIds.has(userId)) return false;
  recentlyRegisteredUserIds.delete(userId);
  return true;
}

const oidcPlugin = oidcConfig
  ? genericOAuth({
      config: [oidcConfig],
    })
  : null;

export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: {
    fallback: env.authUrl,
    allowedHosts: env.authAllowedHosts,
    protocol: env.authProtocol,
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
    disableSignUp: false,
  },
  plugins: oidcPlugin ? [oidcPlugin, adminPlugin] : [adminPlugin],
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      canAccessTrackers: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      canAccessCases: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const registrationEnabled = await getRegistrationEnabled();
          if (!registrationEnabled) {
            throw new Error("Registration is currently disabled.");
          }
        },
        after: async (createdUser, context) => {
          if (createdUser?.id) {
            await handleFirstUserPromotion(createdUser.id);
            markUserJustRegistered(createdUser.id);
            try {
              await logAuditEvent({
                actorUserId: createdUser.id,
                action: "user_registered",
                resourceType: "user",
                resourceId: createdUser.id,
                severity: "info",
                ...getAuditContextFromHeaders(context?.headers),
                metadata: { email: createdUser.email, name: createdUser.name },
              });
            } catch {
              // Never break registration if audit logging fails
            }
          }
        },
      },
    },
    session: {
      create: {
        after: async (session, context) => {
          if (!session?.userId) return;
          if (consumeJustRegistered(session.userId)) return;
          try {
            await logAuditEvent({
              actorUserId: session.userId,
              action: "user_login",
              resourceType: "user",
              resourceId: session.userId,
              severity: "info",
              ...getAuditContextFromHeaders(context?.headers),
            });
          } catch {
            // Never break login if audit logging fails
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type AuthUser = typeof auth.$Infer.Session.user;
