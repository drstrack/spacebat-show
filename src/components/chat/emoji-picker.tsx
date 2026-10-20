import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const TABS = [
  {
    id: "faces",
    label: "Faces",
    emoji: [
      ["😀", "grinning face"],
      ["😁", "beaming face"],
      ["😂", "face with tears of joy"],
      ["🤣", "rolling on the floor laughing"],
      ["😊", "smiling face with smiling eyes"],
      ["😍", "smiling face with heart-eyes"],
      ["😘", "face blowing a kiss"],
      ["😎", "smiling face with sunglasses"],
      ["🤔", "thinking face"],
      ["😅", "grinning face with sweat"],
      ["😭", "loudly crying face"],
      ["😡", "enraged face"],
      ["🤯", "exploding head"],
      ["😴", "sleeping face"],
      ["🙄", "face with rolling eyes"],
      ["🥳", "partying face"],
    ],
  },
  {
    id: "hands",
    label: "Hands",
    emoji: [
      ["👍", "thumbs up"],
      ["👎", "thumbs down"],
      ["👏", "clapping hands"],
      ["🙌", "raising hands"],
      ["🤝", "handshake"],
      ["👋", "waving hand"],
      ["✌️", "victory hand"],
      ["🤞", "crossed fingers"],
      ["💪", "flexed biceps"],
      ["🙏", "folded hands"],
      ["👌", "OK hand"],
      ["👊", "oncoming fist"],
    ],
  },
  {
    id: "show",
    label: "Show",
    emoji: [
      ["🦇", "bat"],
      ["🚀", "rocket"],
      ["🛰️", "satellite"],
      ["🌌", "milky way"],
      ["🎙️", "studio microphone"],
      ["🎧", "headphone"],
      ["🔴", "red circle"],
      ["⭐", "star"],
    ],
  },
  {
    id: "reactions",
    label: "Reactions",
    emoji: [
      ["❤️", "red heart"],
      ["🧡", "orange heart"],
      ["💛", "yellow heart"],
      ["💚", "green heart"],
      ["💙", "blue heart"],
      ["💜", "purple heart"],
      ["🔥", "fire"],
      ["✨", "sparkles"],
      ["💯", "hundred points"],
      ["🎉", "party popper"],
      ["👀", "eyes"],
      ["💀", "skull"],
    ],
  },
] as const;

const COLUMNS = 8;

export function EmojiPicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const items = TABS[tab]?.emoji ?? [];

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLButtonElement>("[data-emoji]");
    first?.focus();
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onGridKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const buttons = [
      ...(panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]") ?? []),
    ];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowRight") next = Math.min(buttons.length - 1, current + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, current + COLUMNS);
    else if (event.key === "ArrowUp") next = Math.max(0, current - COLUMNS);
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Add emoji"
        className="border-4 border-ink bg-paper px-2 py-1 text-base leading-none hover:bg-caption"
        onClick={() => setOpen((value) => !value)}
      >
        😊
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Emoji"
          className="absolute bottom-full left-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] border-4 border-ink bg-paper p-2 shadow-[4px_4px_0_0_var(--color-ink)]"
          onKeyDown={onGridKey}
        >
          <div role="tablist" aria-label="Emoji groups" className="flex flex-wrap gap-1">
            {TABS.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`${labelId}-${entry.id}`}
                aria-selected={index === tab}
                className={
                  index === tab
                    ? "bg-caption px-2 py-1 text-xs"
                    : "px-2 py-1 text-xs text-muted hover:text-ink"
                }
                onClick={() => setTab(index)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {items.map(([emoji, name]) => (
              <button
                key={emoji}
                type="button"
                data-emoji=""
                aria-label={name}
                className="flex h-8 items-center justify-center text-xl hover:bg-caption"
                onClick={() => {
                  onInsert(emoji);
                  close();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
