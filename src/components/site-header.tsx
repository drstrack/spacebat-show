import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BatMark } from "@/components/bat-mark";
import { Button } from "@/components/ui/button";
import { show } from "@/data/show";
import { cn } from "@/lib/utils";

const links = [
  { to: "/listen", label: "Podcast" },
  { to: "/story", label: "The name" },
  { to: "/hosts", label: "The crew" },
] as const;

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-4 border-ink bg-caption">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-ink"
          onClick={() => setOpen(false)}
        >
          <BatMark className="size-9 border-2 border-ink" />
          <span className="font-display text-2xl tracking-wide">SpaceBat</span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "px-3 py-2 font-display text-base tracking-wide text-ink/70 hover:text-ink",
                  (pathname === l.to ||
                    (l.to === "/listen" && pathname.startsWith("/podcast/"))) &&
                    "text-crimson",
                )}
              >
                {l.label}
              </Link>
            ))}
            <Button asChild size="sm" className="ml-2">
              <Link to="/podcast">Listen</Link>
            </Button>
          </nav>
          <a
            href={show.socials.showX}
            target="_blank"
            rel="noreferrer"
            aria-label="@spacebatshow on X"
            className="inline-flex size-10 items-center justify-center border-4 border-ink bg-paper text-ink hover:bg-ink hover:text-caption"
          >
            <XLogo className="size-4" />
          </a>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center border-4 border-ink bg-paper text-ink md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t-4 border-ink bg-paper md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-3 py-3 font-display text-xl tracking-wide text-ink/70",
                  (pathname === l.to ||
                    (l.to === "/listen" && pathname.startsWith("/podcast/"))) &&
                    "text-crimson",
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/podcast"
              onClick={() => setOpen(false)}
              className="px-3 py-3 font-display text-xl tracking-wide text-crimson"
            >
              Listen
            </Link>
            <a
              href={show.socials.showX}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 px-3 py-3 font-display text-xl tracking-wide text-ink"
            >
              <XLogo className="size-4" />
              @spacebatshow
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
