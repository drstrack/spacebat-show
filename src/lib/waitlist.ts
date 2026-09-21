import { createServerFn } from "@tanstack/react-start";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function readEnv(key: string): string | undefined {
  const v = globalThis.process?.env?.[key]?.trim();
  return v || undefined;
}

/**
 * Notify the show inbox when someone joins the list.
 * Destination and API key are server-only. Never return or log them to the client.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator(parseSignup)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const dest = readEnv("NOTIFY_EMAIL");
    const apiKey = readEnv("RESEND_API_KEY");
    if (!dest || !apiKey) {
      console.error("[waitlist] mail env missing", {
        dest: Boolean(dest),
        key: Boolean(apiKey),
      });
      throw new Error("Could not send that signup. Try again in a moment.");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SpaceBat <beth.t@example.com>",
        to: [dest],
        subject: "SpaceBat waitlist",
        text: `${data.email} asked to be notified when SpaceBat episodes drop.`,
      }),
    });

    if (!res.ok) {
      console.error("[waitlist] notify failed", { status: res.status });
      throw new Error("Could not send that signup. Try again in a moment.");
    }

    return { ok: true };
  });
