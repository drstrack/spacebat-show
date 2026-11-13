import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getLinkPreviews, type LinkPreviewResult } from "@/lib/chat/link-preview.server";

export type { LinkPreviewResult, LinkPreviewStatus } from "@/lib/chat/link-preview.server";
export type { LinkPreview } from "@/lib/chat/link-urls";

const MAX_URLS = 8;
const MAX_URL_LENGTH = 2000;

export const previewChatLinks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { urls?: unknown }) => {
    if (!input || !Array.isArray(input.urls) || input.urls.length > MAX_URLS) {
      throw new Error("Couldn't load that link.");
    }
    const urls: string[] = [];
    for (const item of input.urls) {
      if (typeof item !== "string" || item.length === 0 || item.length > MAX_URL_LENGTH) {
        throw new Error("Couldn't load that link.");
      }
      urls.push(item);
    }
    return { urls };
  })
  .handler(async ({ data, context }): Promise<LinkPreviewResult[]> =>
    getLinkPreviews(context.userId, data.urls),
  );
