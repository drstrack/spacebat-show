export type ChatMember = {
  handle: string;
  rulesAccepted: boolean;
  muted: boolean;
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
