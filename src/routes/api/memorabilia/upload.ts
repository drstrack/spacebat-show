import { createFileRoute } from "@tanstack/react-router";
import { handleMemorabiliaClientUpload } from "@/lib/memorabilia/frames.server";

export const Route = createFileRoute("/api/memorabilia/upload")({
  server: {
    handlers: {
      POST: ({ request }) => handleMemorabiliaClientUpload(request),
    },
  },
});
