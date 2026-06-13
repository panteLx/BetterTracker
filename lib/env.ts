function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  databaseUrl: process.env.DATABASE_URL || "file:./data/sqlite.db",
  authSecret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
  authUrl: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  authAllowedHosts:
    parseCsv(process.env.BETTER_AUTH_ALLOWED_HOSTS).length > 0
      ? parseCsv(process.env.BETTER_AUTH_ALLOWED_HOSTS)
      : ["localhost", "127.0.0.1", "192.168.100.13"],
  authTrustedOrigins:
    parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS).length > 0
      ? parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://192.168.100.13:3000",
        ],
  allowUserRegistration: process.env.ALLOW_USER_REGISTRATION !== "false",
  defaultLocale: process.env.DEFAULT_LOCALE || "de-DE",
  timezone: process.env.TZ || "Europe/Berlin",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  discordDebug: process.env.DISCORD_DEBUG === "true",
  discordPingRoleId: process.env.DISCORD_PING_ROLE_ID || "",
};
