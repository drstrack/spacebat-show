import { createFileRoute } from "@tanstack/react-router";
import { handleTechClientUpload } from "@/lib/tech/products.server";

export const Route = createFileRoute("/api/tech/upload")({
  server: {
    handlers: {
      POST: ({ request }) => handleTechClientUpload(request),
    },
  },
});
