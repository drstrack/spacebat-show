import { createFileRoute } from "@tanstack/react-router";
import { ChatRoom } from "@/components/chat/chat-room";

export const Route = createFileRoute("/chat/popout")({
  head: () => ({
    meta: [{ title: "SpaceBat Chat" }, { name: "robots", content: "noindex" }],
  }),
  component: PopoutPage,
});

function PopoutPage() {
  return <ChatRoom layout="popout" />;
}
