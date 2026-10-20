export type ChatMember = {
  handle: string;
  rulesAccepted: boolean;
  muted: boolean;
  /** Epoch ms when a current mute ends. Null when the member can post. */
  mutedUntilMs: number | null;
  banned: boolean;
};

export type ChatMe = {
  signedIn: boolean;
  member: ChatMember | null;
  isAdmin: boolean;
  durable: boolean;
  /** True only when the server has GIPHY_API_KEY. The key itself never leaves the server. */
  gifSearch: boolean;
};

export type ChatMessage = {
  id: number;
  handle: string;
  body: string;
  createdMs: number;
  kind: "text" | "system";
  mine: boolean;
  /** Present only for admins, so mute and ban can target the author. */
  authorId?: string;
};

/** A removed row has no body. */
export type ChatRemoved = { id: number; deleted: true };

export type ChatListItem = ChatMessage | ChatRemoved;

export type ChatLiveSource = "stream" | "feed" | "manual";

/** What the room is showing right now. `source` is how it was decided. */
export type ChatLive = {
  isLive: boolean;
  sinceMs: number | null;
  source: ChatLiveSource | null;
};

export type ChatList = {
  messages: ChatListItem[];
  nextPollMs: number;
  live: ChatLive;
};

export function isRemoved(item: ChatListItem): item is ChatRemoved {
  return "deleted" in item && item.deleted === true;
}
