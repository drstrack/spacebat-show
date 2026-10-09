const CREW = "spacebatshow@gmail.com";

/** Tells the crew inbox that someone created an account. Failures stay off the signup path. */
export async function notifyNewAccount(user: { email: string; name: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESET_FROM?.trim() || "SpaceBat Show <noreply@spacebatshow.net>";
  if (!key) {
    console.error("signup notice skipped");
    return;
  }
  const name = user.name?.trim() || "Listener";
  const email = user.email.trim();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: CREW,
        reply_to: email,
        subject: "New SpaceBat account",
        text: `Someone created an account.\n\nName: ${name}\nEmail: ${email}\n`,
      }),
    });
    if (!response.ok) console.error("signup notice failed", response.status);
  } catch (error) {
    console.error("signup notice failed", error instanceof Error ? error.message : "error");
  }
}
