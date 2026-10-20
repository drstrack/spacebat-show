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

/** A removed row has no body. `live` is the hook for a later live-show alert. */
export type ChatRemoved = { id: number; deleted: true };

export type ChatListItem = ChatMessage | ChatRemoved;

export type ChatList = {
  messages: ChatListItem[];
  nextPollMs: number;
  live: null;
};

export function isRemoved(item: ChatListItem): item is ChatRemoved {
  return "deleted" in item && item.deleted === true;
}
