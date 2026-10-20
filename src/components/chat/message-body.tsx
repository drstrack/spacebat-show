import { useState } from "react";
import { isEmojiOnly, tokenize, type ChatToken } from "@/lib/chat/render";

export function MessageBody({ body, showImages }: { body: string; showImages: boolean }) {
  const tokens = tokenize(body);
  const large = isEmojiOnly(body);
  return (
    <div
      className={
        large
          ? "mt-1 whitespace-pre-wrap break-words text-4xl leading-tight"
          : "mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed"
      }
    >
      {tokens.map((token, index) => (
        <TokenView key={index} token={token} showImages={showImages} />
      ))}
    </div>
  );
}

function TokenView({ token, showImages }: { token: ChatToken; showImages: boolean }) {
  if (token.type === "text") return <span>{token.value}</span>;
  if (token.type === "link" || !showImages) {
    const href = token.type === "link" ? token.href : token.href;
    const label = token.type === "link" ? token.label : token.href.replace(/^https?:\/\//i, "");
    return <ChatLink href={href} label={label} />;
  }
  return <ChatImage token={token} />;
}

function ChatLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="break-all text-crimson underline underline-offset-2"
    >
      {label}
    </a>
  );
}

function ChatImage({ token }: { token: Extract<ChatToken, { type: "image" }> }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ChatLink href={token.href} label={token.href.replace(/^https?:\/\//i, "")} />;
  return (
    <a
      href={token.href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="my-2 block max-w-[280px]"
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden border-2 border-ink/30 bg-paper">
        <img
          src={token.src}
          alt={token.alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-[280px] max-w-[280px] object-contain"
        />
      </span>
      {token.giphy ? (
        <span className="mt-1 flex items-center gap-1 text-[10px] text-muted">
          <span>Powered by</span>
          <img src="/brand/powered-by-giphy.png" alt="GIPHY" className="h-3 w-auto" />
        </span>
      ) : null}
    </a>
  );
}
