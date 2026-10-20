/**
 * PLACEHOLDER — Daniel has not signed off on the final slur list.
 * These combine with rows in `chat_blockword`. Seed nothing in SQL.
 * Matched case-insensitively on word boundaries after NFKC normalization.
 */
export const DEFAULT_BLOCKWORDS = [
  "nigger",
  "niggers",
  "faggot",
  "faggots",
  "kike",
  "spic",
  "chink",
  "tranny",
] as const;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function normalizeMatchText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/** A room word is one token, 2–32 letters or numbers, stored normalized. */
export function normalizeBlockword(raw: string): string | null {
  const word = normalizeMatchText(raw).trim();
  if (!/^[\p{L}\p{N}]{2,32}$/u.test(word)) return null;
  return word;
}

function isWordChar(char: string): boolean {
  return char !== "" && WORD_CHAR.test(char);
}

/** Returns the matched word, or null. "classic" does not match a listed "ass". */
export function containsBlockedWord(body: string, words: readonly string[]): string | null {
  const haystack = normalizeMatchText(body);
  for (const word of words) {
    const needle = normalizeMatchText(word).trim();
    if (!needle) continue;
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      const before = at === 0 ? "" : haystack.charAt(at - 1);
      const after = haystack.charAt(at + needle.length);
      if (!isWordChar(before) && !isWordChar(after)) return needle;
      from = at + 1;
    }
  }
  return null;
}
