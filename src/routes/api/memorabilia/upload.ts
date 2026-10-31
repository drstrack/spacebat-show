import { createFileRoute } from "@tanstack/react-router";
import { uploadMemorabilia } from "@/lib/memorabilia/frames.server";

export const Route = createFileRoute("/api/memorabilia/upload")({
  server: {
    handlers: {
      POST: ({ request }) => uploadMemorabilia(request),
    },
  },
});
