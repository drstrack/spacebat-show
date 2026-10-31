import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  deleteMemorabiliaFrame,
  loadCollectionPage,
  moveMemorabiliaFrame,
} from "@/lib/memorabilia/frames.server";

export const loadMemorabilia = createServerFn({ method: "GET" }).handler(async () =>
  loadCollectionPage(),
);

export const deleteMemorabilia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    if (!input || typeof input.id !== "number" || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That frame isn't on the page.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await deleteMemorabiliaFrame(context.userId, data.id);
    return { ok: true as const };
  });

export const moveMemorabilia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; direction: "earlier" | "later" }) => {
    if (!input || typeof input.id !== "number" || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That frame isn't on the page.");
    }
    if (input.direction !== "earlier" && input.direction !== "later") {
      throw new Error("That frame isn't on the page.");
    }
    return { id: input.id, direction: input.direction };
  })
  .handler(async ({ data, context }) => {
    await moveMemorabiliaFrame(context.userId, data.id, data.direction);
    return { ok: true as const };
  });
