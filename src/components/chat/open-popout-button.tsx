import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

const POPUP = "popup,width=420,height=720";

export function OpenPopoutButton() {
  const [narrow, setNarrow] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (narrow) return;
    event.preventDefault();
    const child = window.open("/chat/popout", "spacebat-chat", POPUP);
    if (child) {
      child.focus();
      setBlocked(false);
      return;
    }
    setBlocked(true);
    const fallback = document.createElement("a");
    fallback.href = "/chat/popout";
    fallback.target = "_blank";
    fallback.rel = "noopener";
    fallback.click();
  }

  return (
    <div className="mt-3">
      <a
        href="/chat/popout"
        target={narrow ? undefined : "_blank"}
        rel={narrow ? undefined : "noopener"}
        onClick={onClick}
        className="inline-flex items-center gap-2 font-display text-xl tracking-wide text-crimson hover:underline"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        Open in new window
      </a>
      {blocked ? (
        <p className="mt-2 text-sm text-muted">
          Your browser blocked the pop-up, so it opened in a new tab.
        </p>
      ) : null}
    </div>
  );
}
