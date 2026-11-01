import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cleanCaption, framePixelSize, MEMORABILIA_PATH } from "@/lib/memorabilia/frames";
import {
  deleteMemorabiliaFrame,
  loadCollectionPage,
  moveMemorabiliaFrame,
  recordMemorabiliaFrame,
  replaceMemorabiliaFrame,
  updateMemorabiliaCaption,
} from "@/lib/memorabilia/frames.server";

export const loadMemorabilia = createServerFn({ method: "GET" }).handler(async () =>
  loadCollectionPage(),
);

function readPixels(input: { width?: unknown; height?: unknown }): { width: number | null; height: number | null } {
  const width = input.width == null ? null : framePixelSize(input.width);
  const height = input.height == null ? null : framePixelSize(input.height);
  if (input.width != null && width == null) throw new Error("That picture isn't available.");
  if (input.height != null && height == null) throw new Error("That picture isn't available.");
  return { width, height };
}

export const recordMemorabilia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { pathname: string; originalPathname?: string; caption?: string; width?: number; height?: number }) => {
    if (!input || typeof input.pathname !== "string" || !MEMORABILIA_PATH.test(input.pathname)) {
      throw new Error("That picture isn't available.");
    }
    if (input.originalPathname != null && !MEMORABILIA_PATH.test(input.originalPathname)) {
      throw new Error("That picture isn't available.");
    }
    const caption = cleanCaption(typeof input.caption === "string" ? input.caption : "");
    if (typeof caption !== "string") throw new Error(caption.error);
    const pixels = readPixels(input);
    return {
      pathname: input.pathname,
      originalPathname: input.originalPathname,
      caption,
      width: pixels.width,
      height: pixels.height,
    };
  })
  .handler(async ({ data, context }) => recordMemorabiliaFrame(context.userId, data));

export const replaceMemorabilia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; pathname: string; originalPathname?: string; width?: number; height?: number }) => {
    if (!input || typeof input.id !== "number" || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That frame isn't on the page.");
    }
    if (typeof input.pathname !== "string" || !MEMORABILIA_PATH.test(input.pathname)) {
      throw new Error("That picture isn't available.");
    }
    if (input.originalPathname != null && !MEMORABILIA_PATH.test(input.originalPathname)) {
      throw new Error("That picture isn't available.");
    }
    const pixels = readPixels(input);
    return {
      id: input.id,
      pathname: input.pathname,
      originalPathname: input.originalPathname,
      width: pixels.width,
      height: pixels.height,
    };
  })
  .handler(async ({ data, context }) => replaceMemorabiliaFrame(context.userId, data));

export const editMemorabiliaCaption = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; caption?: string }) => {
    if (!input || typeof input.id !== "number" || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error("That frame isn't on the page.");
    }
    const caption = cleanCaption(typeof input.caption === "string" ? input.caption : "");
    if (typeof caption !== "string") throw new Error(caption.error);
    return { id: input.id, caption };
  })
  .handler(async ({ data, context }) => updateMemorabiliaCaption(context.userId, data.id, data.caption));

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
