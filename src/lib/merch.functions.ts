import { createServerFn } from "@tanstack/react-start";

/** Fourthwall shop origin, e.g. https://spacebatshow.fourthwall.com. Empty until connected. */
export const loadMerchShop = createServerFn({ method: "GET" }).handler(async () => {
  const shopUrl = (process.env.FOURTHWALL_SHOP_URL ?? "").trim().replace(/\/$/, "");
  return { shopUrl };
});
