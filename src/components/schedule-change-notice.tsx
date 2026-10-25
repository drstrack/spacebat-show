import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SCHEDULE_CHANGE_NOTICE, scheduleChangeVisible } from "@/lib/schedule-change";
import { cn } from "@/lib/utils";

const rootRoute = getRouteApi("__root__");

const STANDING_SHOW_TIME = "The SpaceBat Show is Live every Wednesday at 8:30pm EST";

/**
 * Server and client share the root loader clock for the first paint, so the
 * notice cannot hydrate to a different sentence. After mount, the client clock
 * hides it at 2026-10-30 00:00 America/New_York.
 */
function useScheduleNow(): number {
  const { scheduleNowMs } = rootRoute.useLoaderData();
  const [nowMs, setNowMs] = useState(scheduleNowMs);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return nowMs;
}

export function ScheduleChangeNotice({ className }: { className?: string }) {
  const nowMs = useScheduleNow();
  if (!scheduleChangeVisible(nowMs)) return null;

  return (
    <aside
      role="status"
      className={cn(
        "border-4 border-ink bg-caption px-3 py-3 text-ink shadow-[4px_4px_0_0_#141414] sm:px-4",
        className,
      )}
    >
      <p className="font-display text-lg leading-tight tracking-wide sm:text-2xl">
        {SCHEDULE_CHANGE_NOTICE}
      </p>
    </aside>
  );
}

/** Standing weekly line. Hidden while this week's Thursday notice is up. */
export function StandingShowTime({ className }: { className?: string }) {
  const nowMs = useScheduleNow();
  if (scheduleChangeVisible(nowMs)) return null;
  return (
    <p className={cn("text-base leading-relaxed text-muted", className)}>{STANDING_SHOW_TIME}</p>
  );
}
