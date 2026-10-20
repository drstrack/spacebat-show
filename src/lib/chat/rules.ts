/** Bump when the room rules change. Members must accept the current version. */
export const CHAT_RULES_VERSION = 1;

/**
 * Daniel decides the final age wording. The room shows this line as written.
 */
export const AGE_POLICY = "You must be 13 or older to join.";

export const CHAT_RULES = [
  "Be decent: no harassment, hate or threats.",
  "No doxxing or sharing anyone's personal info.",
  "No spam or ads.",
  "Keep it legal.",
  "Hosts can delete messages and remove people.",
  AGE_POLICY,
] as const;
