import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { env } from "@/lib/env";
import {
  DEFAULT_OIDC_DISPLAY_NAME,
  OIDC_PROVIDER_ID,
} from "@/lib/auth/oidc-constants";

function getString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getProfileName(profile: Record<string, unknown>) {
  const directName = getString(profile.name);
  if (directName) {
    return directName;
  }

  const preferredUsername = getString(profile.preferred_username);
  if (preferredUsername) {
    return preferredUsername;
  }

  const combinedName = [getString(profile.given_name), getString(profile.family_name)]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (combinedName) {
    return combinedName;
  }

  return getString(profile.email);
}

function buildOidcConfig(): GenericOAuthConfig | null {
  const discoveryUrl = env.oidcDiscoveryUrl.trim();
  const clientId = env.oidcClientId.trim();

  if (!discoveryUrl || !clientId) {
    return null;
  }

  return {
    providerId: OIDC_PROVIDER_ID,
    discoveryUrl,
    clientId,
    clientSecret: env.oidcClientSecret || undefined,
    scopes: env.oidcScopes,
    pkce: true,
    disableImplicitSignUp: true,
    mapProfileToUser(profile) {
      return {
        name: getProfileName(profile),
        image: getString(profile.picture),
      };
    },
  };
}

export const oidcDisplayName =
  env.oidcDisplayName.trim() || DEFAULT_OIDC_DISPLAY_NAME;
export const oidcConfig = buildOidcConfig();
export const oidcEnabled = oidcConfig !== null;
