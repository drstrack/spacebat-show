/**
 * Pure Turso env-key selection. Kept out of `db.ts` so tests can import it
 * without booting PGLite or opening a database.
 */
export type TursoEnv = Record<string, string | undefined>;

export type TursoKeyPair = {
  urlKey: string;
  tokenKey: string;
};

function isTursoUrlKey(key: string): boolean {
  return key === "TURSO_DATABASE_URL" || key.endsWith("_TURSO_DATABASE_URL");
}

/**
 * Which `*_TURSO_DATABASE_URL` key to use.
 *
 * - `VERCEL_ENV=preview` — only `PREVIEW_*` keys, so a preview cannot open
 *   the production database.
 * - `VERCEL_ENV=production` — ignore `PREVIEW_*` keys.
 * - otherwise (local) — today's rule: every Turso URL key, preferring one
 *   whose name mentions "spacebat".
 */
export function pickTursoKeys(env: TursoEnv): TursoKeyPair | null {
  const mode = env.VERCEL_ENV;
  const keys = Object.keys(env).filter((key) => {
    if (!isTursoUrlKey(key)) return false;
    if (mode === "preview") return key.startsWith("PREVIEW_");
    if (mode === "production") return !key.startsWith("PREVIEW_");
    return true;
  });
  const urlKey = keys.find((key) => /spacebat/i.test(key)) ?? keys[0];
  if (!urlKey) return null;
  return {
    urlKey,
    tokenKey: urlKey.replace(/DATABASE_URL$/, "AUTH_TOKEN"),
  };
}
