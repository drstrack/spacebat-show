import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subscribe")({
  beforeLoad: () => {
    throw redirect({ to: "/podcast" });
  },
});
