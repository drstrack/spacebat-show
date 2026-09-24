import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BatMark } from "@/components/bat-mark";
import { show } from "@/data/show";

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-ink/80 hover:text-crimson"
    >
      {children}
      {label}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-4 border-ink bg-caption">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BatMark className="size-8 border-2 border-ink" />
            <span className="font-display text-2xl tracking-wide">SpaceBat</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-ink">
            A podcast from John Mulligan and Daniel Strack. Comics, movies,
            tech, politics, markets. Named, tongue in cheek, for the bat that
            clung to Discovery on March 15, 2009.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm md:col-span-2 md:grid-cols-3">
          <div className="space-y-2">
            <p className="font-display text-base tracking-wide">Show</p>
            <Link to="/podcast" className="block text-ink/80 hover:text-crimson">
              Podcast
            </Link>
            <Link to="/story" className="block text-ink/80 hover:text-crimson">
              The name
            </Link>
            <Link to="/hosts" className="block text-ink/80 hover:text-crimson">
              The crew
            </Link>
          </div>
          <div className="space-y-4">
            <p className="font-display text-base tracking-wide">Follow</p>
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/50">The show</p>
              <SocialLink href={show.socials.showX} label="@spacebatshow">
                <XLogo />
              </SocialLink>
            </div>
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/50">Dan</p>
              <SocialLink href={show.socials.danX} label="@danielrstrack">
                <XLogo />
              </SocialLink>
              <SocialLink href={show.socials.danLinkedIn} label="LinkedIn">
                <LinkedInLogo />
              </SocialLink>
            </div>
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/50">John</p>
              <SocialLink href={show.socials.johnX} label="@tma_alpha">
                <XLogo />
              </SocialLink>
              <SocialLink href={show.socials.johnLinkedIn} label="LinkedIn">
                <LinkedInLogo />
              </SocialLink>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-display text-base tracking-wide">The booth</p>
            <p className="text-ink/80">Comics · Movies · Tech</p>
            <p className="text-ink/80">Politics · Markets</p>
          </div>
        </div>
      </div>
      <div className="border-t-4 border-ink bg-ink text-caption">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs uppercase tracking-[0.12em] sm:px-6">
          Historical launch photographs courtesy NASA, public domain. The cape
          is a joke. SpaceBat the show is independent of NASA.
        </p>
      </div>
    </footer>
  );
}
