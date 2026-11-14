import { publicHttpUrl } from "../chat/link-preview.ts";

/** Same rule as `mediaAdminDecision`: a signed-in admin may write. Everyone else may read. */
export function techAdminDecision(input: {
  signedIn: boolean;
  role: string | null | undefined;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!input.signedIn) return { ok: false, status: 401, error: "Unauthorized" };
  if (input.role !== "admin") return { ok: false, status: 403, error: "Crew only." };
  return { ok: true };
}

export const TECH_PAGE_TITLE = "Tech";
export const TECH_PAGE_HEAD = `${TECH_PAGE_TITLE} · SpaceBat`;
export const TECH_DESCRIPTION = "Tech products John and Dan use and recommend.";
export const TECH_URL = "https://www.spacebatshow.net/tech";
export const TECH_OG_IMAGE = "/og.jpg";

export const TECH_SORT_MAX = 100_000;
export const TECH_NAME_MAX = 120;
export const TECH_DESCRIPTION_MAX = 2_000;
export const TECH_URL_MAX = 2_000;

export const LOCAL_TECH_SRC = /^\/tech\/uploads\/[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$/;

export const TECH_BLOB_PATH =
  /^tech\/\d{4}-\d{2}\/[a-z0-9]+-[a-z0-9][a-z0-9._-]{0,120}\.(jpg|jpeg|png|webp|gif)$/;

const TECH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TechHost = "john" | "dan" | "both";
export type TechImageSource = "auto" | "custom";

export type TechProduct = {
  id: string;
  name: string;
  description: string;
  productUrl: string;
  imageUrl: string | null;
  imageSource: TechImageSource;
  autoImageUrl: string | null;
  recommendedBy: TechHost | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TechInput = {
  id?: string;
  name: string;
  description: string;
  productUrl: string;
  imageSource: TechImageSource;
  customImageUrl: string | null;
  recommendedBy: TechHost | null;
  sortOrder: number | null;
};

export type StoredImage = {
  imageUrl: string | null;
  imageSource: TechImageSource;
  autoImageUrl: string | null;
};

export type ImagePlan = {
  imageSource: TechImageSource;
  copyFrom: string | null;
  keepAutoUrl: string | null;
  autoDisplayUrl: string | null;
  customImageUrl: string | null;
};

type TechRow = {
  id: string;
  name: string;
  description: string | null;
  product_url: string;
  image_url: string | null;
  image_source: string | null;
  auto_image_url: string | null;
  recommended_by: string | null;
  sort_order: number | string | bigint | null;
  created_at: unknown;
  updated_at: unknown;
};

export type TechSql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

export type FetchedProduct = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

export type TechIo = {
  now: () => Date;
  newId: () => string;
  /** Throws when the URL is not allowed. Returns null when the fetch fails. */
  fetchProduct: (url: string) => Promise<FetchedProduct | null>;
  /** `keepRemote` is false when the URL is blocked, not an image, or over the size cap. */
  copyImage: (url: string) => Promise<{ url: string | null; keepRemote: boolean }>;
};

export function techBlobPathname(originalName: string, now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const cleaned = originalName
    .split(/[/\\]/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `tech/${month}/${random}-${cleaned || "image.jpg"}`;
}

export function techHostLabel(host: TechHost | null): string | null {
  if (host === "john") return "John";
  if (host === "dan") return "Dan";
  if (host === "both") return "John and Dan";
  return null;
}

/**
 * Swap two neighbors in the public list. Equal sort numbers still move: the
 * item heading later takes the next whole number.
 */
export function swappedSortOrders(
  current: number,
  neighbor: number,
  direction: "earlier" | "later",
): { current: number; neighbor: number } {
  if (current !== neighbor) return { current: neighbor, neighbor: current };
  const atCap = current >= TECH_SORT_MAX;
  if (direction === "earlier") {
    return atCap ? { current: current - 1, neighbor: current } : { current, neighbor: current + 1 };
  }
  return atCap ? { current, neighbor: current - 1 } : { current: current + 1, neighbor };
}

function cleanText(value: unknown, max: number): string | { error: string } {
  if (value == null) return "";
  if (typeof value !== "string") return { error: "That needs to be text." };
  if (value.length > max * 4) return { error: "That text is too long." };
  let cleaned = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const control = (code <= 31 || code === 127) && code !== 9 && code !== 10;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    if (!control && !bidi) cleaned += char;
  }
  return cleaned.trim().slice(0, max);
}

export function parseHttpUrl(value: string, label = "That link"): URL | { error: string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > TECH_URL_MAX) return { error: `${label} needs to be an http(s) URL.` };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: `${label} needs to be an http(s) URL.` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: `${label} needs to be an http(s) URL.` };
  }
  const safe = publicHttpUrl(trimmed);
  if (!safe) return { error: "That link isn't allowed." };
  return safe;
}

export function parseImageUrl(value: string): string | { error: string } {
  const trimmed = value.trim();
  if (LOCAL_TECH_SRC.test(trimmed)) return trimmed;
  const url = parseHttpUrl(trimmed, "That picture");
  if ("error" in url) {
    return url.error === "That link isn't allowed."
      ? { error: "That picture link isn't allowed." }
      : { error: "That picture needs to be an http(s) URL." };
  }
  return url.toString();
}

export function safeProductUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseHttpUrl(value);
  return "error" in parsed ? null : parsed.toString();
}

export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseImageUrl(value);
  return typeof parsed === "string" ? parsed : null;
}

export function parseTechInput(input: unknown): TechInput | { error: string } {
  if (!input || typeof input !== "object") return { error: "That product needs a name." };
  const row = input as Record<string, unknown>;
  let id: string | undefined;
  if (row.id != null && row.id !== "") {
    if (typeof row.id !== "string" || !TECH_ID.test(row.id)) return { error: "That product isn't on the page." };
    id = row.id;
  }
  const name = cleanText(row.name, TECH_NAME_MAX);
  if (typeof name !== "string") return name;
  const description = cleanText(row.description, TECH_DESCRIPTION_MAX);
  if (typeof description !== "string") return description;
  if (typeof row.productUrl !== "string") return { error: "That link needs to be an http(s) URL." };
  const product = parseHttpUrl(row.productUrl);
  if ("error" in product) return product;
  if (row.imageSource !== "auto" && row.imageSource !== "custom") {
    return { error: "Pick the automatic picture or your own." };
  }
  let customImageUrl: string | null = null;
  if (row.imageSource === "custom") {
    if (typeof row.customImageUrl !== "string" || !row.customImageUrl.trim()) {
      return { error: "Add a picture or use the automatic one." };
    }
    const image = parseImageUrl(row.customImageUrl);
    if (typeof image !== "string") return image;
    customImageUrl = image;
  }
  let recommendedBy: TechHost | null = null;
  if (row.recommendedBy != null && row.recommendedBy !== "") {
    if (row.recommendedBy !== "john" && row.recommendedBy !== "dan" && row.recommendedBy !== "both") {
      return { error: "Pick John, Dan, or both." };
    }
    recommendedBy = row.recommendedBy;
  }
  let sortOrder: number | null = null;
  if (row.sortOrder != null && row.sortOrder !== "") {
    if (typeof row.sortOrder !== "number" || !Number.isInteger(row.sortOrder) || row.sortOrder < 0 || row.sortOrder > TECH_SORT_MAX) {
      return { error: "Sort order needs to be a whole number." };
    }
    sortOrder = row.sortOrder;
  }
  return {
    id,
    name,
    description,
    productUrl: product.toString(),
    imageSource: row.imageSource,
    customImageUrl,
    recommendedBy,
    sortOrder,
  };
}

export function mergeEmptyCopy(
  current: { name: string; description: string },
  fetched: FetchedProduct | null,
): { name: string; description: string } {
  if (!fetched) return current;
  const title = fetched.title?.trim().slice(0, TECH_NAME_MAX) ?? "";
  const description = fetched.description?.trim().slice(0, TECH_DESCRIPTION_MAX) ?? "";
  return {
    name: current.name || title,
    description: current.description || description,
  };
}

/**
 * A custom picture is never replaced by a fetched one. Changing the product
 * URL refreshes the automatic picture. Reverting to auto uses that picture.
 */
export function planTechImage(input: {
  previous: StoredImage | null;
  urlChanged: boolean;
  requestedSource: TechImageSource;
  customImageUrl: string | null;
  fetchedAutoUrl: string | null | undefined;
}): ImagePlan {
  const copyFrom = input.urlChanged && input.fetchedAutoUrl ? input.fetchedAutoUrl : null;
  const keepAutoUrl = copyFrom ? null : input.urlChanged ? null : (input.previous?.autoImageUrl ?? null);
  if (input.requestedSource === "custom") {
    return {
      imageSource: "custom",
      copyFrom,
      keepAutoUrl,
      autoDisplayUrl: null,
      customImageUrl: input.customImageUrl,
    };
  }
  const autoDisplayUrl = input.urlChanged
    ? null
    : (input.previous?.autoImageUrl ?? (input.previous?.imageSource === "auto" ? input.previous.imageUrl : null));
  return {
    imageSource: "auto",
    copyFrom,
    keepAutoUrl,
    autoDisplayUrl,
    customImageUrl: null,
  };
}

export function applyTechImagePlan(plan: ImagePlan, copiedUrl: string | null, keepRemote: boolean): StoredImage {
  const autoImageUrl = plan.copyFrom ? (copiedUrl ?? (keepRemote ? plan.copyFrom : null)) : plan.keepAutoUrl;
  if (plan.imageSource === "custom") {
    return { imageSource: "custom", imageUrl: plan.customImageUrl, autoImageUrl };
  }
  return {
    imageSource: "auto",
    imageUrl: plan.copyFrom ? autoImageUrl : plan.autoDisplayUrl,
    autoImageUrl,
  };
}

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function hostOf(value: string | null): TechHost | null {
  if (value === "john" || value === "dan" || value === "both") return value;
  return null;
}

function toProduct(row: TechRow): TechProduct | null {
  if (!row.id || !row.name || !row.product_url) return null;
  const imageSource: TechImageSource = row.image_source === "custom" ? "custom" : "auto";
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    productUrl: String(row.product_url),
    imageUrl: row.image_url ? String(row.image_url) : null,
    imageSource,
    autoImageUrl: row.auto_image_url ? String(row.auto_image_url) : null,
    recommendedBy: hostOf(row.recommended_by),
    sortOrder: num(row.sort_order),
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at),
  };
}

async function roleOf(sql: TechSql, userId: string): Promise<string | null> {
  const rows = await sql<{ role: string | null }>`select role from member_profile where user_id = ${userId}`;
  return rows[0]?.role ?? null;
}

async function assertAdmin(sql: TechSql, userId: string): Promise<void> {
  const decision = techAdminDecision({ signedIn: Boolean(userId), role: await roleOf(sql, userId) });
  if (!decision.ok) throw new Error(decision.error);
}

async function readOne(sql: TechSql, id: string): Promise<TechProduct | null> {
  const rows = await sql<TechRow>`
    select id, name, description, product_url, image_url, image_source, auto_image_url,
           recommended_by, sort_order, created_at, updated_at
    from tech_product
    where id = ${id}
  `;
  return rows[0] ? toProduct(rows[0]) : null;
}

async function nextSort(sql: TechSql): Promise<number> {
  const rows = await sql<{ next_sort: number | string | bigint | null }>`
    select coalesce(max(sort_order), -1) + 1 as next_sort from tech_product
  `;
  return num(rows[0]?.next_sort);
}

export async function listTechProducts(sql: TechSql): Promise<TechProduct[]> {
  const rows = await sql<TechRow>`
    select id, name, description, product_url, image_url, image_source, auto_image_url,
           recommended_by, sort_order, created_at, updated_at
    from tech_product
    order by sort_order asc, created_at asc
  `;
  return rows.flatMap((row) => {
    const product = toProduct(row);
    return product ? [product] : [];
  });
}

export async function saveTechProduct(
  sql: TechSql,
  userId: string,
  input: unknown,
  io: TechIo,
): Promise<TechProduct> {
  await assertAdmin(sql, userId);
  const parsed = parseTechInput(input);
  if ("error" in parsed) throw new Error(parsed.error);
  const previous = parsed.id ? await readOne(sql, parsed.id) : null;
  if (parsed.id && !previous) throw new Error("That product isn't on the page.");
  const urlChanged = !previous || previous.productUrl !== parsed.productUrl;
  let fetched: FetchedProduct | null = null;
  if (urlChanged) {
    try {
      fetched = await io.fetchProduct(parsed.productUrl);
    } catch (err) {
      const blocked = err instanceof Error && err.message === "That link isn't allowed.";
      if (blocked) throw err;
      fetched = null;
    }
  }
  const copy = mergeEmptyCopy(
    { name: parsed.name, description: parsed.description },
    urlChanged ? fetched : null,
  );
  if (!copy.name) throw new Error("That product needs a name.");
  const plan = planTechImage({
    previous,
    urlChanged,
    requestedSource: parsed.imageSource,
    customImageUrl: parsed.customImageUrl,
    fetchedAutoUrl: urlChanged ? (fetched?.imageUrl ?? null) : undefined,
  });
  const copied = plan.copyFrom ? await io.copyImage(plan.copyFrom) : { url: null, keepRemote: false };
  const image = applyTechImagePlan(plan, copied.url, copied.keepRemote);
  const sortOrder = parsed.sortOrder ?? previous?.sortOrder ?? (await nextSort(sql));
  const now = io.now().toISOString();
  const id = previous?.id ?? io.newId();
  const createdAt = previous?.createdAt || now;
  if (!previous) {
    await sql`
      insert into tech_product (
        id, name, description, product_url, image_url, image_source, auto_image_url,
        recommended_by, sort_order, created_at, updated_at
      ) values (
        ${id}, ${copy.name}, ${copy.description}, ${parsed.productUrl}, ${image.imageUrl},
        ${image.imageSource}, ${image.autoImageUrl}, ${parsed.recommendedBy}, ${sortOrder},
        ${createdAt}, ${now}
      )
    `;
  } else {
    await sql`
      update tech_product set
        name = ${copy.name},
        description = ${copy.description},
        product_url = ${parsed.productUrl},
        image_url = ${image.imageUrl},
        image_source = ${image.imageSource},
        auto_image_url = ${image.autoImageUrl},
        recommended_by = ${parsed.recommendedBy},
        sort_order = ${sortOrder},
        updated_at = ${now}
      where id = ${id}
    `;
  }
  return {
    id,
    name: copy.name,
    description: copy.description,
    productUrl: parsed.productUrl,
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    autoImageUrl: image.autoImageUrl,
    recommendedBy: parsed.recommendedBy,
    sortOrder,
    createdAt,
    updatedAt: now,
  };
}

export async function deleteTechProduct(sql: TechSql, userId: string, id: string): Promise<void> {
  await assertAdmin(sql, userId);
  if (!TECH_ID.test(id)) throw new Error("That product isn't on the page.");
  const existing = await readOne(sql, id);
  if (!existing) throw new Error("That product isn't on the page.");
  await sql`delete from tech_product where id = ${id}`;
}
