import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ViewBeacon } from "@/components/view-beacon";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/chat/popout")) {
    return (
      <main id="main" className="min-h-dvh bg-paper text-ink">
        {children}
      </main>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border-4 focus:border-ink focus:bg-caption focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <SiteHeader />
      <ViewBeacon />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
