const CREW = "spacebatshow@gmail.com";

function site() {
  return (process.env.BETTER_AUTH_URL?.trim() || "https://www.spacebatshow.net").replace(/\/$/, "");
}

function greeting(name: string) {
  const first = name.split(/\s+/)[0];
  return first && first.toLowerCase() !== "listener" ? `${first},\n\n` : "";
}

async function send(key: string, from: string, message: Record<string, string>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
  });
  if (!response.ok) console.error("signup mail failed", response.status);
}

/** Welcomes the new account and tells the crew. Failures stay off the signup path. */
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
  const home = site();
  try {
    await Promise.all([
      send(key, from, {
        to: email,
        reply_to: CREW,
        subject: "Welcome to the SpaceBat Show",
        text:
          `${greeting(name)}` +
          `You're in. John and Dan are glad you made an account.\n\n` +
          `The show is live Wednesdays at 8:30pm EST:\n${home}/podcast\n\n` +
          `Podcast alerts, the newsletter, and merch notes are on your account page:\n${home}/account\n`,
      }),
      send(key, from, {
        to: CREW,
        reply_to: email,
        subject: "New SpaceBat account",
        text: `Someone created an account.\n\nName: ${name}\nEmail: ${email}\n`,
      }),
    ]);
  } catch (error) {
    console.error("signup notice failed", error instanceof Error ? error.message : "error");
  }
}
