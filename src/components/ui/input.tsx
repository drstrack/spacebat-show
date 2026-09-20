import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xs border-4 border-ink bg-ivory px-4 text-base text-ink placeholder:text-faint",
        "shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson",
        className,
      )}
      {...props}
    />
  );
}
