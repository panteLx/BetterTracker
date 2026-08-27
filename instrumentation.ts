export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Reading the signing secret validates it, so a misconfigured deployment
  // fails at container start instead of on the first request that touches auth.
  const { env } = await import("./lib/env");
  void env.authSecret;

  if (process.env.RUN_MIGRATIONS === "true") {
    const { migrateDatabase } = await import("./instrumentation.node");
    migrateDatabase();
  }
}
