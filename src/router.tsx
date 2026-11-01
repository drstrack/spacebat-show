import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Hash targets sit under the sticky header. scroll-margin on those
    // sections keeps scrollIntoView from hiding them, on a click and on a fresh load.
    defaultHashScrollIntoView: { block: "start" },
  });
}
