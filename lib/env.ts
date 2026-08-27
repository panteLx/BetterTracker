function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const oidcScopes = parseCsv(process.env.OIDC_SCOPES);

const DEV_AUTH_SECRET = "dev-secret-change-me";
const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * Better Auth derives every symmetric operation from this secret (session
 * cookie HMAC, verification/change-email tokens, OAuth state). A shipped
 * fallback would be the same publicly-known constant on every install, so in
 * production a real secret is required and the process refuses to boot without
 * one.
 *
 * Two cases must not throw: `next build` runs with NODE_ENV=production but has
 * no runtime secrets, and this module reaches the client bundle through
 * `lib/i18n/config`, where no server secret exists in the first place. Both
 * keep the development fallback — neither ever signs anything.
 */
function resolveAuthSecret(value: string | undefined) {
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isBrowser = typeof window !== "undefined";

  if (process.env.NODE_ENV !== "production" || isBuildPhase || isBrowser) {
    return value || DEV_AUTH_SECRET;
  }

  if (!value || value === DEV_AUTH_SECRET || value.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set to a random string of at least " +
        `${MIN_AUTH_SECRET_LENGTH} characters in production. ` +
        "Generate one with: openssl rand -base64 32"
    );
  }

  return value;
}

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

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function dedupe(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1"];

const parsedAuthUrl = parseUrl(authUrl);
const authUrlIsLoopback =
  !parsedAuthUrl || LOOPBACK_HOSTS.includes(parsedAuthUrl.hostname);

/**
 * `BETTER_AUTH_ALLOWED_HOSTS` and `BETTER_AUTH_TRUSTED_ORIGINS` both default
 * to the app's own `BETTER_AUTH_URL`, so a single-domain deployment only has
 * to type its domain once instead of in three different env vars. The env
 * vars still exist, but only need to be set for the rare case of a *second*
 * reachable hostname/IP (e.g. behind two proxies, or reachable by both a
 * domain and a raw IP) — anything listed there is added on top of this
 * default rather than replacing it.
 */
const defaultAllowedHosts = dedupe([...LOOPBACK_HOSTS, parsedAuthUrl?.hostname]);

const defaultTrustedOrigins = parsedAuthUrl
  ? dedupe([
      parsedAuthUrl.origin,
      ...(authUrlIsLoopback
        ? LOOPBACK_HOSTS.map(
            (host) =>
              `${parsedAuthUrl.protocol}//${host}${
                parsedAuthUrl.port ? `:${parsedAuthUrl.port}` : ""
              }`
          )
        : []),
    ])
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

let cachedAuthSecret: string | null = null;

export const env = {
  databaseUrl: process.env.DATABASE_URL || "file:./data/sqlite.db",
  /**
   * Resolved lazily: importing this module must stay side-effect free, because
   * the client bundle pulls it in for `defaultLocale` and would otherwise blow
   * up in the browser on a check that only makes sense on the server.
   */
  get authSecret() {
    cachedAuthSecret ??= resolveAuthSecret(process.env.BETTER_AUTH_SECRET);
    return cachedAuthSecret;
  },
  authUrl,
  authProtocol: getAuthProtocol(authUrl),
  authAllowedHosts: dedupe([
    ...defaultAllowedHosts,
    ...parseCsv(process.env.BETTER_AUTH_ALLOWED_HOSTS),
  ]),
  authTrustedOrigins: dedupe([
    ...defaultTrustedOrigins,
    ...parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]),
  oidcDisplayName: process.env.OIDC_DISPLAY_NAME || "OpenID Connect",
  oidcDiscoveryUrl: process.env.OIDC_DISCOVERY_URL || "",
  oidcClientId: process.env.OIDC_CLIENT_ID || "",
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET || "",
  oidcScopes:
    oidcScopes.length > 0 ? oidcScopes : ["openid", "profile", "email"],
  /**
   * CIDR ranges of reverse proxies that are allowed to write
   * `X-Forwarded-For`. Leave unset when the app is exposed directly: the
   * header is then client-supplied and is ignored for rate limiting and
   * audit logging rather than trusted.
   */
  trustedProxies: parseCsv(process.env.TRUSTED_PROXY_CIDRS),
  defaultLocale: process.env.DEFAULT_LOCALE || "en-US",
  timezone: process.env.TZ || "Europe/Berlin",
};
