import { z } from "zod";
import { ValidationError } from "@/lib/errors";

const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com",
]);

const DISCORD_WEBHOOK_MESSAGE =
  "Must be an https://discord.com/api/webhooks/… URL";

/**
 * The webhook URL is user-supplied and the server dials it, so an unrestricted
 * value turns every tracker into an SSRF primitive against the Docker network
 * or a cloud metadata endpoint. Only real Discord webhook endpoints are
 * accepted; an empty string keeps its existing meaning of "notifications off".
 */
export function isDiscordWebhookUrl(value: string) {
  if (value === "") {
    return true;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    DISCORD_WEBHOOK_HOSTS.has(url.hostname) &&
    url.pathname.startsWith("/api/webhooks/")
  );
}

export const discordWebhookUrlSchema = z
  .string()
  .trim()
  .refine(isDiscordWebhookUrl, DISCORD_WEBHOOK_MESSAGE);

/** Trims and validates a webhook URL, throwing a 400-mapped error when invalid. */
export function parseDiscordWebhookUrl(value: string) {
  const trimmed = value.trim();
  if (!isDiscordWebhookUrl(trimmed)) {
    throw new ValidationError(DISCORD_WEBHOOK_MESSAGE);
  }
  return trimmed;
}
