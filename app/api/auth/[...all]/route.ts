import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { logAuditEvent } from "@/lib/audit-log";

const { GET, POST: authPOST } = toNextJsHandler(auth);
export { GET };

const AUTH_LOG_PATHS = ["/sign-in/email", "/sign-up/email", "/sign-in/social"];

export async function POST(request: Request) {
  const url = new URL(request.url);
  const isSignIn =
    AUTH_LOG_PATHS.some((p) => url.pathname.endsWith(p)) &&
    !url.pathname.endsWith("/sign-up/email");
  const isSignUp = url.pathname.endsWith("/sign-up/email");

  const response = await authPOST(request);

  if ((isSignIn || isSignUp) && response.ok) {
    try {
      const body = await response.clone().json();
      const userId = body?.user?.id ?? null;
      const email = body?.user?.email ?? null;
      const name = body?.user?.name ?? null;

      if (userId) {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null;
        const ua = request.headers.get("user-agent") ?? null;

        await logAuditEvent({
          actorUserId: userId,
          action: isSignUp ? "user_registered" : "user_login",
          resourceType: "user",
          resourceId: userId,
          severity: "info",
          ipAddress: ip,
          userAgent: ua,
          metadata: { email, name },
        });
      }
    } catch {
      // Never break auth if logging fails
    }
  }

  return response;
}
