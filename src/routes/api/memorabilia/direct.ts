import { createFileRoute } from "@tanstack/react-router";
import { saveDirectMemorabilia } from "@/lib/memorabilia/frames.server";

/** Local PGLite only. Production uploads go to Blob through /api/memorabilia/upload. */
export const Route = createFileRoute("/api/memorabilia/direct")({
  server: {
    handlers: {
      POST: ({ request }) => saveDirectMemorabilia(request),
    },
  },
});
