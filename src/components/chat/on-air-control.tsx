import { useState } from "react";
import { adminSetLive } from "@/lib/chat/live.functions";
import type { ChatLive } from "@/lib/chat/types";

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "Couldn’t change the on-air state.";
}

function sourceLabel(live: ChatLive | null): string {
  if (live?.source === "manual") return "manual";
  if (live?.source === "stream") return "auto: stream";
  if (live?.source === "feed") return "auto: feed";
  return "auto";
}

export function OnAirControl({
  live,
  onChange,
}: {
  live: ChatLive | null;
  onChange: (live: ChatLive) => void;
}) {
  const [busy, setBusy] = useState<"live" | "off" | "auto" | null>(null);
  const [error, setError] = useState("");
  const manualLive = live?.source === "manual" && live.isLive;
  const manualOff = live?.source === "manual" && !live.isLive;

  async function setMode(mode: "live" | "off" | "auto") {
    setBusy(mode);
    setError("");
    try {
      onChange(await adminSetLive({ data: { mode } }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">On air · {sourceLabel(live)}</span>
      <button
        type="button"
        aria-pressed={manualLive}
        disabled={busy != null}
        onClick={() => void setMode("live")}
        className="border-2 border-ink bg-paper px-2 py-0.5 text-xs hover:bg-caption disabled:opacity-50"
      >
        {busy === "live" ? "…" : "Go live"}
      </button>
      <button
        type="button"
        aria-pressed={manualOff}
        disabled={busy != null}
        onClick={() => void setMode("off")}
        className="border-2 border-ink bg-paper px-2 py-0.5 text-xs hover:bg-caption disabled:opacity-50"
      >
        {busy === "off" ? "…" : "End live"}
      </button>
      <button
        type="button"
        aria-pressed={!manualLive && !manualOff}
        disabled={busy != null}
        onClick={() => void setMode("auto")}
        className="border-2 border-ink bg-paper px-2 py-0.5 text-xs hover:bg-caption disabled:opacity-50"
      >
        {busy === "auto" ? "…" : "Auto"}
      </button>
      {error ? <span className="text-xs text-crimson">{error}</span> : null}
    </div>
  );
}
