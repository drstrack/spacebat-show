/** Sends the Better Auth reset link through Resend. */
export async function sendPasswordReset(to: string, url: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESET_FROM?.trim() || "SpaceBat Show <noreply@spacebatshow.net>";
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
    throw new Error("Could not send the reset email");
  }
}
