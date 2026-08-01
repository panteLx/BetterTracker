function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const oidcScopes = parseCsv(process.env.OIDC_SCOPES);
const authUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

function getAuthProtocol(value: string): "http" | "https" | "auto" {
  if (value.startsWith("https://")) {
    return "https";
  }

  if (value.startsWith("http://")) {
    return "http";
  }

  return "auto";
}

export const env = {
  databaseUrl: process.env.DATABASE_URL || "file:./data/sqlite.db",
  authSecret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
  authUrl,
  authProtocol: getAuthProtocol(authUrl),
  authAllowedHosts:
    parseCsv(process.env.BETTER_AUTH_ALLOWED_HOSTS).length > 0
      ? parseCsv(process.env.BETTER_AUTH_ALLOWED_HOSTS)
      : ["localhost", "127.0.0.1"],
  authTrustedOrigins:
    parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS).length > 0
      ? parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
  oidcDisplayName: process.env.OIDC_DISPLAY_NAME || "OpenID Connect",
  oidcDiscoveryUrl: process.env.OIDC_DISCOVERY_URL || "",
  oidcClientId: process.env.OIDC_CLIENT_ID || "",
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET || "",
  oidcScopes:
    oidcScopes.length > 0 ? oidcScopes : ["openid", "profile", "email"],
  defaultLocale: process.env.DEFAULT_LOCALE || "en-US",
  timezone: process.env.TZ || "Europe/Berlin",
};
