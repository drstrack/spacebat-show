import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ChatAttachment } from "@/lib/chat/types";
import { isUploadPathname } from "@/lib/chat/uploads";
import {
  confirmChatUpload as confirmUpload,
  discardOwnUpload as discardUpload,
  prepareChatUpload as prepareUpload,
} from "@/lib/chat/uploads.server";

export const prepareChatUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; type: string; size: number }) => {
    if (!input || typeof input.name !== "string" || typeof input.type !== "string") {
      throw new Error("That file type isn't allowed.");
    }
    if (typeof input.size !== "number" || !Number.isFinite(input.size)) {
      throw new Error("That file type isn't allowed.");
    }
    return { name: input.name.slice(0, 200), type: input.type.slice(0, 120), size: input.size };
  })
  .handler(async ({ data, context }) => prepareUpload(context.userId, data));

export const confirmChatUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { pathname: string; name?: string }) => {
    if (!input || typeof input.pathname !== "string" || !isUploadPathname(input.pathname)) {
      throw new Error("That attachment isn't available.");
    }
    const name = typeof input.name === "string" ? input.name.slice(0, 200) : "";
    return { pathname: input.pathname, name };
  })
  .handler(async ({ data, context }): Promise<ChatAttachment> => confirmUpload(context.userId, data));

export const discardChatUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    if (!input || typeof input.id !== "number" || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That attachment isn't available.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await discardUpload(context.userId, data.id);
    return { ok: true as const };
  });
