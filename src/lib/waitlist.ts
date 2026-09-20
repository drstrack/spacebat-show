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

/**
 * Notify the show inbox when someone joins the list.
 * Destination is server-only (NOTIFY_EMAIL). Never return or log it to the client.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator(parseSignup)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const dest = process.env.NOTIFY_EMAIL?.trim();
    if (!dest) {
      // Preview / misconfigured deploy: still accept so the form isn't a dead end.
      return { ok: true };
    }

    const res = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(dest)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          _subject: "SpaceBat waitlist",
          _template: "box",
          _captcha: "false",
          _honey: "",
          message: `${data.email} asked to be notified when SpaceBat episodes drop.`,
        }),
      },
    );

    if (!res.ok) {
      throw new Error("Could not send that signup. Try again in a moment.");
    }

    return { ok: true };
  });
