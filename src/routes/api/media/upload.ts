import { createFileRoute } from "@tanstack/react-router";
import { handleMediaClientUpload } from "@/lib/media.server";

export const Route = createFileRoute("/api/media/upload")({
  server: {
    handlers: {
      POST: ({ request }) => handleMediaClientUpload(request),
    },
  },
});
