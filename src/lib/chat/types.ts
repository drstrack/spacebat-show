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
  /** True only when the server has a blob read-write token. The token never leaves the server. */
  uploads: boolean;
  /** Public host for this room's blob store, or null when uploads are off. */
  blobHost: string | null;
};

export type ChatAttachment = {
  id: number;
  url: string;
  name: string;
  size: number;
  contentType: string;
  kind: "image" | "file";
};

export type ChatMessage = {
  id: number;
  handle: string;
  body: string;
  createdMs: number;
  kind: "text" | "system" | "presence";
  mine: boolean;
  /** Present only for admins, so mute and ban can target the author. */
  authorId?: string;
  attachment: ChatAttachment | null;
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

/** A member whose heartbeat is still inside the leave window. No email, no user id. */
export type ChatOnlineMember = {
  handle: string;
  imageUrl: string | null;
  you: boolean;
};

export type ChatList = {
  messages: ChatListItem[];
  nextPollMs: number;
  live: ChatLive;
  online: ChatOnlineMember[];
};

export function isRemoved(item: ChatListItem): item is ChatRemoved {
  return "deleted" in item && item.deleted === true;
}
