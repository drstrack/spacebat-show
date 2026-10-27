import { scheduleChangeVisible } from "../schedule-change.ts";

const CREW = "spacebatshow@gmail.com";

const WEDNESDAY_LINE = "The show is live Wednesdays at 8:30pm EST:";
const THIS_WEEK_LINE = "This week only, the show is Thursday, Oct 29 at 8:30 PM ET.";

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

/** Welcome body. The Thursday sentence drops out on its own after the cutoff. */
export function welcomeText(name: string, home: string, now: number | Date = new Date()): string {
  const week = scheduleChangeVisible(now) ? `\n\n${THIS_WEEK_LINE}` : "";
  return (
    `${greeting(name)}` +
    `You're in. John and Dan are glad you made an account.\n\n` +
    `${WEDNESDAY_LINE}\n${home}/podcast` +
    `${week}\n\n` +
    `Podcast alerts, the newsletter, and merch notes are on your account page:\n${home}/account\n`
  );
}

/** Welcomes the new account and tells the crew. Failures stay off the signup path. */
export async function notifyNewAccount(user: { email: string; name: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESET_FROM?.trim() || "SpaceBat Show <noreply@spacebatshow.net>";
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
        text: welcomeText(name, home),
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
