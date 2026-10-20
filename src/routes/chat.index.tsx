import { createFileRoute } from "@tanstack/react-router";
import { ChatRoom } from "@/components/chat/chat-room";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [{ title: "Chat — SpaceBat" }, { name: "robots", content: "noindex" }],
  }),
  component: ChatPage,
});

function ChatPage() {
  return <ChatRoom layout="page" />;
}
