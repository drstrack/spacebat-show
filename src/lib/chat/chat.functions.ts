import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  deleteOwnMessage as removeOwnMessage,
  getChatMe as readChatMe,
  joinChat as saveChatJoin,
  listChat as readChatMessages,
  postChat as saveChatMessage,
} from "@/lib/chat/chat.server";
import type { ChatList, ChatMember, ChatMe, ChatMessage } from "@/lib/chat/types";

export type {
  ChatList,
  ChatListItem,
  ChatLive,
  ChatMe,
  ChatMember,
  ChatMessage,
  ChatOnlineMember,
  ChatRemoved,
} from "@/lib/chat/types";

export const getChatMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ChatMe> => readChatMe(context.userId));

export const joinChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { handle: string; acceptRules: boolean }) => {
    if (!input || typeof input.handle !== "string") throw new Error("Pick a name first.");
    if (input.acceptRules !== true) throw new Error("Accept the room rules to join.");
    return { handle: input.handle, acceptRules: true as const };
  })
  .handler(async ({ data, context }): Promise<ChatMember> => saveChatJoin(context.userId, data));

export const listChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { after?: number; before?: number } | undefined) => {
    const after = input?.after;
    const before = input?.before;
    if (after != null && (!Number.isInteger(after) || after < 0)) {
      throw new Error("Couldn’t load messages.");
    }
    if (before != null && (!Number.isInteger(before) || before < 0)) {
      throw new Error("Couldn’t load messages.");
    }
    if (after != null && before != null) throw new Error("Couldn’t load messages.");
    return { after, before };
  })
  .handler(async ({ data, context }): Promise<ChatList> => readChatMessages(context.userId, data));

export const postChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { body: string; nonce: string; uploadId?: number }) => {
    if (!input || typeof input.body !== "string") throw new Error("Write a message first.");
    if (typeof input.nonce !== "string" || input.nonce.length < 8 || input.nonce.length > 80) {
      throw new Error("Couldn’t send that.");
    }
    let uploadId: number | undefined;
    if (input.uploadId != null) {
      if (typeof input.uploadId !== "number" || !Number.isInteger(input.uploadId) || input.uploadId <= 0) {
        throw new Error("That attachment isn't available.");
      }
      uploadId = input.uploadId;
    }
    if (!input.body.trim() && uploadId == null) throw new Error("Write a message first.");
    return { body: input.body, nonce: input.nonce, uploadId };
  })
  .handler(async ({ data, context }): Promise<ChatMessage> =>
    saveChatMessage(context.userId, data),
  );

export const deleteOwnMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    if (!input || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That message is gone.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => removeOwnMessage(context.userId, data));
