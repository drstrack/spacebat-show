import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { recordPageView } from "@/lib/account.functions";

/** Count one visit per path per browser session. */
export function ViewBeacon() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const key = `spacebat-view:${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    void recordPageView({ data: pathname });
  }, [pathname]);

  return null;
}
