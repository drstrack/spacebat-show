import { useEffect, useRef, useState } from "react";
import { show } from "@/data/show";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "playing" | "off";

export function LivePlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setStatus("idle");
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing" || status === "connecting") {
      stop();
      return;
    }
    setStatus("connecting");
    audio.src = show.liveStream;
    try {
      await audio.play();
      setStatus("playing");
    } catch {
      stop();
      setStatus("off");
    }
  }

  const label =
    status === "playing" ? "Stop" : status === "connecting" ? "Connecting…" : "Play live";

  return (
    <div className="mt-5">
      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onPlaying={() => setStatus("playing")}
        onError={() => setStatus("off")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={toggle}>
          {label}
        </Button>
        <p className="text-sm text-muted">
          {status === "playing"
            ? "On the air."
            : status === "connecting"
              ? "Tuning the booth…"
              : status === "off"
                ? "Not on the air right now. Try again when the show starts."
                : "Plays here. No extra tab."}
        </p>
      </div>
    </div>
  );
}
