import { createServerFn } from "@tanstack/react-start";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE = "https://www.spacebatshow.net";

function parseSignup(input: unknown): { email: string } {
  const raw =
    typeof input === "object" && input && "email" in input
      ? String((input as { email: unknown }).email)
      : "";
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new Error("Enter a valid email.");
  }
  return { email };
}

function notifyDest(): string | undefined {
  const v = globalThis.process?.env?.["NOTIFY_EMAIL"]?.trim();
  return v || undefined;
}

function relayMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; success?: unknown };
    return String(parsed.message ?? JSON.stringify(parsed)).slice(0, 180);
  } catch {
    return body.slice(0, 180);
  }
}

function relayAccepted(status: number, body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { success?: boolean | string; message?: string };
    const success = parsed.success === true || parsed.success === "true";
    const message = String(parsed.message ?? "");
    if (success || /activat/i.test(message)) return true;
  } catch {
    if (status >= 200 && status < 300 && !/error|fail/i.test(body)) return true;
  }
  return false;
}

function scrub(text: string): string {
  return text.replace(EMAIL_RE, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 140);
}

async function postRelay(dest: string, subscriber: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(dest)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: SITE,
      Referer: `${SITE}/subscribe`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      name: "SpaceBat waitlist",
      email: subscriber,
      _subject: "SpaceBat waitlist",
      _template: "box",
      _captcha: "false",
      _honey: "",
      _url: `${SITE}/subscribe`,
      message: `${subscriber} asked to be notified when SpaceBat episodes drop.`,
    }),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Notify the show inbox when someone joins the list.
 * Destination is server-only (NOTIFY_EMAIL). Never return or log it to the client.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator(parseSignup)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const dest = notifyDest();
    if (!dest) {
      console.error("[waitlist] inbox env missing");
      throw new Error("List is not connected. Try again shortly.");
    }

    const json = await postRelay(dest, data.email);
    if (relayAccepted(json.status, json.body)) return { ok: true };

    const hint = scrub(relayMessage(json.body) || `HTTP ${json.status}`);
    console.error("[waitlist] notify failed", { status: json.status });
    throw new Error(`Could not send that signup (${hint || json.status}).`);
  });
