import { cn } from "@/lib/utils";

export function BatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" fill="#141414" />
      <rect x="12" y="3" width="8" height="26" fill="#e45a12" />
      <path
        fill="#f6e7c1"
        d="M16 11c-2.6.8-5.2 1.8-7.2.5 1.6 2 3.8 4 7.2 4s5.6-2 7.2-4c-2 1.3-4.6.3-7.2-.5zM11.2 12.2c-1-.2-1.9-.9-2.6-1.8 1 .9 2 1.5 2.6 1.8zm9.6 0c.6-.3 1.6-.9 2.6-1.8-.7.9-1.6 1.6-2.6 1.8zM16 13.8c-.55 0-1 .5-1 1.1 0 .4.35.7 1 .7s1-.3 1-.7c0-.6-.45-1.1-1-1.1z"
      />
    </svg>
  );
}
