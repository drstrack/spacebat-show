/** Bump when the room rules change. Members must accept the current version. */
export const CHAT_RULES_VERSION = 1;

/**
 * PLACEHOLDER — Daniel has not set the age minimum.
 * Default: 13+. The room shows `AGE_POLICY` as written.
 */
export const AGE_MINIMUM = 13;
export const AGE_POLICY = "You must be 13 or older to join.";

/**
 * PLACEHOLDER — Daniel has not set retention.
 * Default: keep every message. Nothing here hard-deletes rows.
 */
export const CHAT_HISTORY_RETENTION = "keep-all" as const;

/**
 * PLACEHOLDER — Daniel has not set who moderates.
 * Default: only `member_profile.role = 'admin'`.
 */
export const CHAT_MODERATORS = "admins-only" as const;

export const CHAT_RULES = [
  "Be decent: no harassment, hate or threats.",
  "No doxxing or sharing anyone's personal info.",
  "No spam or ads.",
  "Keep it legal.",
  "Hosts can delete messages and remove people.",
  AGE_POLICY,
] as const;
