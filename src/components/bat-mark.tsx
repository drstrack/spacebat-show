import { cn } from "@/lib/utils";

/** Superhero-style bat. Orange tank badge, not the yellow-oval mark. */
const BAT =
  "11.95 5.66 15.12 10.59 16 9.54 16.88 10.59 20.05 5.66 19.34 11.3 20.93 11.82 23.22 10.59 27.62 10.59 29.55 12.35 29.64 14.82 26.38 15.7 27.62 19.04 23.22 16.93 24.45 21.33 20.05 18.69 20.75 22.74 16 26.96 11.25 22.74 11.95 18.69 7.55 21.33 8.78 16.93 4.38 19.04 5.62 15.7 2.36 14.82 2.45 12.35 4.38 10.59 8.78 10.59 11.07 11.82 12.66 11.3";

export function BatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" fill="#e45a12" />
      <polygon fill="#141414" points={BAT} />
    </svg>
  );
}
