import { env } from "@/lib/env";

/**
 * Resolves the client IP for logging.
 *
 * `X-Forwarded-For` / `X-Real-IP` are client-supplied unless a proxy we trust
 * wrote them, so an address is only recorded when TRUSTED_PROXY_CIDRS says a
 * proxy sits in front of the app. Otherwise the audit log would store a claim
 * rather than an observation, and `null` is the honest answer.
 *
 * Trusted hops are stripped from the right; the first untrusted hop is the
 * closest thing to an observed address.
 */
export function resolveClientIp(headerStore: Headers | null | undefined): string | null {
  if (!headerStore || env.trustedProxies.length === 0) {
    return null;
  }

  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);

    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const hop = hops[index]!;
      if (!isTrustedProxy(hop)) {
        return hop;
      }
    }

    return null;
  }

  return headerStore.get("x-real-ip")?.trim() || null;
}

function isTrustedProxy(ip: string) {
  return env.trustedProxies.some((entry) => matchesCidr(ip, entry));
}

function matchesCidr(ip: string, entry: string) {
  const [range, bitsRaw] = entry.split("/");
  if (!range) {
    return false;
  }

  const ipBytes = toBytes(ip);
  const rangeBytes = toBytes(range);
  if (!ipBytes || !rangeBytes || ipBytes.length !== rangeBytes.length) {
    return false;
  }

  const bits = bitsRaw === undefined ? ipBytes.length * 8 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > ipBytes.length * 8) {
    return false;
  }

  let remaining = bits;
  for (let index = 0; index < ipBytes.length && remaining > 0; index += 1) {
    const mask = remaining >= 8 ? 0xff : (0xff << (8 - remaining)) & 0xff;
    if ((ipBytes[index]! & mask) !== (rangeBytes[index]! & mask)) {
      return false;
    }
    remaining -= 8;
  }

  return true;
}

/** Parses an IPv4 or (optionally compressed) IPv6 address into its bytes. */
function toBytes(value: string): number[] | null {
  const address = value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;

  if (address.includes(":")) {
    return ipv6ToBytes(address);
  }

  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    bytes.push(octet);
  }

  return bytes;
}

function ipv6ToBytes(address: string): number[] | null {
  const [head, tail, ...rest] = address.split("::");
  if (rest.length > 0 || head === undefined) {
    return null;
  }

  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = 8 - headGroups.length - tailGroups.length;

  if (tail === undefined ? headGroups.length !== 8 : missing < 0) {
    return null;
  }

  const groups =
    tail === undefined
      ? headGroups
      : [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups];

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      return null;
    }
    const word = Number.parseInt(group, 16);
    bytes.push((word >> 8) & 0xff, word & 0xff);
  }

  return bytes;
}
