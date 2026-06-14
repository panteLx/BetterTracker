import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

export const DEFAULT_SETTINGS = {
  discordWebhookUrl: "",
  discordDebugEnabled: false,
  discordPingRoleId: "",
  serverIpDisplay: "",
  directAddSubscriptions: false,
  registrationEnabled: env.allowUserRegistration,
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

export async function getSettings() {
  const rows = await db.select().from(appSettings);
  const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;

  for (const row of rows) {
    merged[row.key] = JSON.parse(row.valueJson);
  }

  return merged as SettingsMap;
}

export async function getSetting<T>(key: keyof SettingsMap): Promise<T> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  if (!rows[0]) {
    return DEFAULT_SETTINGS[key] as T;
  }

  return JSON.parse(rows[0].valueJson) as T;
}

export async function setSetting(
  key: keyof SettingsMap,
  value: unknown,
  updatedByUserId?: string | null
) {
  const existing = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(appSettings)
      .set({
        valueJson: JSON.stringify(value),
        updatedByUserId: updatedByUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appSettings.key, key));
    return;
  }

  await db.insert(appSettings).values({
    key,
    valueJson: JSON.stringify(value),
    updatedByUserId: updatedByUserId ?? null,
  });
}

export async function getRegistrationEnabled() {
  return getSetting<boolean>("registrationEnabled");
}
