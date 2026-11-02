import { MEDIA_HOST_EMAILS } from "./media.ts";

type DbSource = "turso" | "neon" | "pglite";

/**
 * Preview sign-ups for John and Dan become admins so the in-memory preview
 * database can be tested. Production never does this. Turso never does this.
 */
export function previewHostShouldBeAdmin(input: {
  vercelEnv: string | undefined;
  dbSource: DbSource;
  email: string | null | undefined;
}): boolean {
  if (input.vercelEnv === "production") return false;
  if (input.dbSource === "turso") return false;
  const preview = input.vercelEnv === "preview" || input.dbSource === "pglite";
  if (!preview) return false;
  const email = input.email?.trim().toLowerCase() ?? "";
  return email === MEDIA_HOST_EMAILS.john || email === MEDIA_HOST_EMAILS.dan;
}
