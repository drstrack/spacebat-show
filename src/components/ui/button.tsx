import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display tracking-wide uppercase transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40 border-4 border-ink active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  {
    variants: {
      variant: {
        primary: "bg-crimson text-crimson-fg shadow-[4px_4px_0_0_var(--color-ink)] hover:bg-crimson/90",
        secondary:
          "bg-caption text-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:bg-caption/90",
        ghost: "bg-paper text-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:bg-raised",
        link: "border-0 bg-transparent text-crimson underline-offset-4 hover:underline px-0 shadow-none",
      },
      size: {
        sm: "h-10 px-4 text-sm rounded-xs",
        md: "h-11 px-5 text-base rounded-xs",
        lg: "h-12 px-6 text-lg rounded-xs",
        icon: "size-11 rounded-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
