export const MAX_BODY_LENGTH = 1000;
export const POST_GAP_MS = 3_000;
export const POST_WINDOW_MS = 60_000;
export const POST_WINDOW_MAX = 20;

const HANDLE_PATTERN = /^[A-Za-z0-9 _.-]+$/;
const RESERVED_HANDLES = new Set(["admin", "mod", "spacebat", "system", "dan", "john"]);

const HANDLE_FORMAT = "Use 2–24 characters: letters, numbers, spaces, and . _ -.";
const HANDLE_EMAIL = "That name looks like an email.";
const HANDLE_RESERVED = "That name is reserved.";

export type HandleDecision =
  { ok: true; handle: string; handleKey: string } | { ok: false; error: string };

/**
 * Handle rules. The admin exception applies to reserved names only —
 * an email-shaped name is refused for everyone.
 */
export function validateHandle(raw: string, isAdmin: boolean): HandleDecision {
  if (typeof raw !== "string" || raw.length > 80) {
    return { ok: false, error: HANDLE_FORMAT };
  }
  const handle = raw.trim();
  if (handle.includes("@") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)) {
    return { ok: false, error: HANDLE_EMAIL };
  }
  if (handle.length < 2 || handle.length > 24 || !HANDLE_PATTERN.test(handle)) {
    return { ok: false, error: HANDLE_FORMAT };
  }
  const handleKey = handle.toLowerCase();
  if (!isAdmin && RESERVED_HANDLES.has(handleKey)) {
    return { ok: false, error: HANDLE_RESERVED };
  }
  return { ok: true, handle, handleKey };
}

export type BodyDecision = { ok: true; body: string } | { ok: false; error: string };

/** Trim, then collapse 3+ blank lines down to 2. Length is checked after that. */
export function normalizeBody(raw: string): BodyDecision {
  if (typeof raw !== "string") return { ok: false, error: "Write a message first." };
  if (raw.length > 4_000) return { ok: false, error: "Keep it under 1000 characters." };
  const body = collapseBlankLines(raw.replace(/\r\n/g, "\n").trim());
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > MAX_BODY_LENGTH) return { ok: false, error: "Keep it under 1000 characters." };
  return { ok: true, body };
}

function collapseBlankLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blanks += 1;
      if (blanks <= 2) kept.push("");
    } else {
      blanks = 0;
      kept.push(line);
    }
  }
  return kept.join("\n");
}

/**
 * `lastMs` is the caller's newest message time, or null when they've never
 * posted. `countLastMinute` counts messages newer than 60s, not including
 * the one being attempted.
 */
export function canPost(lastMs: number | null, countLastMinute: number, now: number): boolean {
  if (lastMs != null && now - lastMs < POST_GAP_MS) return false;
  if (countLastMinute >= POST_WINDOW_MAX) return false;
  return true;
}
