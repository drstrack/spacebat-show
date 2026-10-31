import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cleanCaption, MEMORABILIA_PATH } from "@/lib/memorabilia/frames";
import {
  deleteMemorabiliaFrame,
  loadCollectionPage,
  moveMemorabiliaFrame,
  recordMemorabiliaFrame,
} from "@/lib/memorabilia/frames.server";

export const loadMemorabilia = createServerFn({ method: "GET" }).handler(async () =>
  loadCollectionPage(),
);

export const recordMemorabilia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { pathname: string; originalPathname?: string; caption?: string }) => {
    if (!input || typeof input.pathname !== "string" || !MEMORABILIA_PATH.test(input.pathname)) {
      throw new Error("That picture isn't available.");
    }
    if (input.originalPathname != null && !MEMORABILIA_PATH.test(input.originalPathname)) {
      throw new Error("That picture isn't available.");
    }
    const caption = cleanCaption(typeof input.caption === "string" ? input.caption : "");
    if (typeof caption !== "string") throw new Error(caption.error);
    return {
      pathname: input.pathname,
      originalPathname: input.originalPathname,
      caption,
    };
  })
  .handler(async ({ data, context }) => recordMemorabiliaFrame(context.userId, data));

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
