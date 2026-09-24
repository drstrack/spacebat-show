import { Link } from "@tanstack/react-router";
import { BatMark } from "@/components/bat-mark";
import { show } from "@/data/show";

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
          <div className="space-y-2">
            <p className="font-display text-base tracking-wide">Follow</p>
            <Link to="/listen" className="block text-ink/80 hover:text-crimson">
              Listen
            </Link>
            <a
              href={show.socials.danX}
              target="_blank"
              rel="noreferrer"
              className="block text-ink/80 hover:text-crimson"
            >
              Dan on X
            </a>
            <a
              href={show.socials.danLinkedIn}
              target="_blank"
              rel="noreferrer"
              className="block text-ink/80 hover:text-crimson"
            >
              Dan on LinkedIn
            </a>
            <a
              href={show.socials.johnLinkedIn}
              target="_blank"
              rel="noreferrer"
              className="block text-ink/80 hover:text-crimson"
            >
              John on LinkedIn
            </a>
          </div>
          <div className="space-y-2">
            <p className="font-display text-base tracking-wide">The booth</p>
            <p className="text-ink/80">Comics · Movies · Tech</p>
            <p className="text-ink/80">Politics · Markets</p>
          </div>
        </div>
      </div>
      <div className="border-t-4 border-ink bg-ink text-caption">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.12em]">
            Historical launch photographs courtesy NASA, public domain. The cape
            is a joke. SpaceBat the show is independent of NASA.
          </p>
          <a
            href={show.socials.showX}
            target="_blank"
            rel="noreferrer"
            aria-label="@spacebatshow on X"
            className="inline-flex size-10 shrink-0 items-center justify-center border-4 border-caption text-caption hover:bg-caption hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
