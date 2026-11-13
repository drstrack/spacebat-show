import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  deleteTechProductForUser,
  loadTechPage,
  previewTechProductForUser,
  saveTechProductForUser,
} from "@/lib/tech/products.server";

export const loadTech = createServerFn({ method: "GET" }).handler(async () => loadTechPage());

export const previewTechLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { url?: string }) => {
    if (!input || typeof input.url !== "string" || !input.url.trim()) {
      throw new Error("That link needs to be an http(s) URL.");
    }
    return { url: input.url.trim().slice(0, 2_000) };
  })
  .handler(async ({ data, context }) => previewTechProductForUser(context.userId, data.url));

export const saveTech = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("That product needs a name.");
    return input;
  })
  .handler(async ({ data, context }) => saveTechProductForUser(context.userId, data));

export const deleteTech = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) {
      throw new Error("That product isn't on the page.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await deleteTechProductForUser(context.userId, data.id);
    return { ok: true as const };
  });
