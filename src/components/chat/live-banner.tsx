import { LivePlayer } from "@/components/live-player";

export function LiveBanner({
  sinceLabel,
  placement,
}: {
  sinceLabel: string | null;
  placement: "room" | "bar";
}) {
  if (placement === "bar") {
    return (
      <p className="border-t-4 border-ink bg-crimson px-3 py-1 text-center font-display text-sm tracking-wide text-crimson-fg">
        🔴 On air now{sinceLabel ? ` · since ${sinceLabel}` : ""}
      </p>
    );
  }

  return (
    <div className="sticky top-0 z-20 border-4 border-ink bg-paper">
      <div className="bg-crimson px-3 py-2 text-crimson-fg">
        <p className="font-display text-2xl tracking-wide">🔴 On air now</p>
        {sinceLabel ? <p className="text-sm">since {sinceLabel}</p> : null}
      </div>
      <div className="px-3 py-2">
        <LivePlayer compact />
      </div>
    </div>
  );
}
