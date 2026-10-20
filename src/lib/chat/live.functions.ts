import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { adminSetLive as setLive } from "@/lib/chat/live.server";
import type { ChatLive } from "@/lib/chat/types";

export const adminSetLive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { mode: string }): { mode: "live" | "off" | "auto" } => {
    if (!input || (input.mode !== "live" && input.mode !== "off" && input.mode !== "auto")) {
      throw new Error("Pick live, off, or auto.");
    }
    return { mode: input.mode };
  })
  .handler(async ({ data, context }): Promise<ChatLive> => setLive(context.userId, data.mode));
