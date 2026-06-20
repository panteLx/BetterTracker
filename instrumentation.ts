export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.RUN_MIGRATIONS === "true"
  ) {
    const { migrateDatabase } = await import("./instrumentation.node");
    migrateDatabase();
  }
}
