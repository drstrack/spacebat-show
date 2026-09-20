import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/")({
  beforeLoad: () => {
    throw redirect({ to: "/podcast" });
  },
});
