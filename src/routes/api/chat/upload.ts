import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import {
  classifyUpload,
  isUploadPathname,
  sanitizeFileName,
  UploadHttpError,
} from "@/lib/chat/uploads";
import { assertCanUpload, blobUploadsEnabled, completeBlobUpload } from "@/lib/chat/uploads.server";

function readDeclared(raw: string | null): { name: string; type: string; size: number } | null {
  if (!raw || raw.length > 1_000) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; type?: unknown; size?: unknown };
    if (typeof parsed.name !== "string" || typeof parsed.type !== "string") return null;
    if (typeof parsed.size !== "number" || !Number.isFinite(parsed.size)) return null;
    return { name: parsed.name, type: parsed.type, size: parsed.size };
  } catch {
    return null;
  }
}

async function handle({ request }: { request: Request }) {
  if (!blobUploadsEnabled()) {
    return Response.json({ error: "Uploads are off." }, { status: 404 });
  }
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "That file type isn't allowed." }, { status: 400 });
  }
  if (!body || (body.type !== "blob.generate-client-token" && body.type !== "blob.upload-completed")) {
    return Response.json({ error: "That file type isn't allowed." }, { status: 400 });
  }

  let userId: string | null = null;
  if (body.type === "blob.generate-client-token") {
    try {
      assertSameSiteRequest();
      userId = await requireUserId();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (err instanceof CrossSiteRequestError) {
        return Response.json({ error: err.message }, { status: 403 });
      }
      const message = err instanceof Error ? err.message : "Unauthorized";
      const status = message === "Unauthorized" ? 401 : 403;
      return Response.json({ error: message }, { status });
    }
  }

  try {
    const json = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!userId) throw new UploadHttpError(401, "Unauthorized");
        const { isAdmin } = await assertCanUpload(userId);
        if (!isUploadPathname(pathname)) throw new UploadHttpError(400, "That file type isn't allowed.");
        const declared = readDeclared(clientPayload);
        if (!declared) throw new UploadHttpError(400, "That file type isn't allowed.");
        const classified = classifyUpload(pathname, declared.type, declared.size);
        if (!classified.ok) throw new UploadHttpError(400, classified.error);
        return {
          allowedContentTypes: [classified.contentType],
          maximumSizeInBytes: classified.maxBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({
            userId,
            name: sanitizeFileName(declared.name),
            admin: isAdmin ? 1 : 0,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        await completeBlobUpload(tokenPayload, blob);
      },
    });
    return Response.json(json);
  } catch (err) {
    if (err instanceof UploadHttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error && err.message ? err.message : "Couldn't upload that file.";
    console.error("chat upload", message);
    return Response.json({ error: message }, { status: 400 });
  }
}

export const Route = createFileRoute("/api/chat/upload")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
