/** Sends the Better Auth reset link through Resend.
 *
 * noreply@spacebatshow.net is not a verified Resend sender yet (DKIM exists,
 * SPF/return-path do not). Until the domain is verified, fall back to
 * onboarding@resend.dev, which can deliver to the Resend account inbox.
 */
export async function sendPasswordReset(to: string, url: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESET_FROM?.trim() || "SpaceBat Show <onboarding@resend.dev>";
  if (!key) {
    throw new Error("Password reset email is not configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: "spacebatshow@gmail.com",
      subject: "Reset your SpaceBat password",
      text: `Set a new password for the SpaceBat Show:\n\n${url}\n\nThis link expires in an hour. If you didn’t ask for it, ignore this note.`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Could not send the reset email (${response.status}): ${detail.slice(0, 240)}`,
    );
  }
}
