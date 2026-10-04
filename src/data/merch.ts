export type MerchPiece = {
  slug: string;
  name: string;
  kind: "Tee" | "Hat";
  line: string;
  image: string;
  alt: string;
};

/** Print files live in the brand kit. Fourthwall prints and ships. */
export const merch: MerchPiece[] = [
  {
    slug: "tank-mark-tee",
    name: "Tank Mark",
    kind: "Tee",
    line: "Black heavyweight. The orange bat, large, on the chest.",
    image: "/merch/tee-tank-mark.jpg",
    alt: "Black t-shirt with the orange SpaceBat emblem centered on the chest.",
  },
  {
    slug: "show-title-tee",
    name: "Show Title",
    kind: "Tee",
    line: "Cream shirt. The bat, then SPACEBAT SHOW in yellow.",
    image: "/merch/tee-show-title.jpg",
    alt: "Cream t-shirt with the orange SpaceBat emblem and SPACEBAT SHOW in yellow comic letters.",
  },
  {
    slug: "night-cap",
    name: "Night Cap",
    kind: "Hat",
    line: "Black dad hat. The bat, stitched in orange.",
    image: "/merch/hat-night.jpg",
    alt: "Black dad hat with a small orange embroidered SpaceBat emblem.",
  },
  {
    slug: "tank-cap",
    name: "Tank Cap",
    kind: "Hat",
    line: "Orange dad hat. The bat, stitched in black.",
    image: "/merch/hat-tank.jpg",
    alt: "Orange dad hat with a small black embroidered SpaceBat emblem.",
  },
];

export function fourthwallProductUrl(shopUrl: string, slug: string) {
  const base = shopUrl.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/products/${slug}`;
}
