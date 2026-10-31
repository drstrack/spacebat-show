import { GATE_SESSION_MARKER_COOKIE } from "@/lib/auth/gate-session-marker";

/**
 * Cookie names from `src/lib/auth/server.ts`. Hardcoded here so this file does
 * not import the auth server (that module must not load in the client graph).
 */
const HTTP_ONLY_COOKIES = [
  "__Host-grok-auth.session_token",
  "__Host-grok-auth.session_data",
  "__Host-grok-auth.account_data",
  "__Host-grok-auth.dont_remember",
];

/** Expire the session cookies after the account row is gone. */
export async function expireAuthCookies(): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    const base = { path: "/", secure: true, sameSite: "lax" as const, maxAge: 0 };
    for (const name of HTTP_ONLY_COOKIES) {
      setCookie(name, "", { ...base, httpOnly: true });
    }
    setCookie(GATE_SESSION_MARKER_COOKIE, "", { ...base, httpOnly: false });
  } catch (err) {
    console.error(
      "[account] could not expire the session cookies",
      err instanceof Error ? err.message : "",
    );
  }
}
