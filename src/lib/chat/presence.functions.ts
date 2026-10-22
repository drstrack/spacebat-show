import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  listPresenceAnnouncements as readPresenceAnnouncements,
  touchPresenceFor,
  type PresenceAnnouncement,
} from "@/lib/chat/presence.server";

export type { PresenceAnnouncement };

export const beatChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await touchPresenceFor(context.userId);
    return { ok: true as const };
  });

export const listPresenceAnnouncements = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PresenceAnnouncement[]> =>
    readPresenceAnnouncements(context.userId),
  );
