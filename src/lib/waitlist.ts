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
  // Dynamic key so the bundler cannot inline an empty build-time value.
  const v = globalThis.process?.env?.["NOTIFY_EMAIL"]?.trim();
  return v || undefined;
}

function formsubmitOk(status: number, body: string): boolean {
  let parsed: { success?: boolean | string; message?: string } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return status >= 200 && status < 300;
  }
  const success = parsed.success === true || parsed.success === "true";
  const message = String(parsed.message ?? "");
  // First post asks the owner to click Activate Form — that still counts as delivered.
  if (success || /activat/i.test(message)) return true;
  return false;
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
      throw new Error("Could not send that signup. Try again in a moment.");
    }

    const payload = {
      name: "SpaceBat waitlist",
      email: data.email,
      _subject: "SpaceBat waitlist",
      _template: "box",
      _captcha: "false",
      _honey: "",
      _url: `${SITE}/subscribe`,
      message: `${data.email} asked to be notified when SpaceBat episodes drop.`,
    };

    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(dest)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: SITE,
            Referer: `${SITE}/subscribe`,
          },
          body: JSON.stringify(payload),
        },
      );
      lastStatus = res.status;
      lastBody = await res.text();
      if (formsubmitOk(lastStatus, lastBody)) {
        return { ok: true };
      }
      if (lastStatus === 429) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }

    console.error("[waitlist] notify failed", { status: lastStatus });
    throw new Error("Could not send that signup. Try again in a moment.");
  });
