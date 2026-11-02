import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobCredentials } from "@/lib/chat/blob-env.server";
import { classifyUpload, IMAGE_MAX_BYTES } from "@/lib/chat/uploads";
import { blobUploadsEnabled } from "@/lib/chat/uploads.server";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { getSql, type Sql } from "@/lib/db";
import {
  hostForEmail,
  isRating,
  MEDIA_BLOB_PATH,
  mediaAdminDecision,
  mediaRatingDecision,
  newestMentionRank,
  parseMediaDraft,
  type MediaEntry,
  type MediaHost,
  type MediaEpisode,
  type MediaRating,
  type MediaRatings,
} from "@/lib/media";

type ItemRow = {
  id: string;
  kind: string;
  title: string;
  year: string;
  wikipedia_url: string;
  image: string | null;
  image_credit: string | null;
  image_kind: string | null;
  width: number | string | bigint | null;
  height: number | string | bigint | null;
  best_guess: number | string | bigint | boolean | null;
  best_guess_reason: string | null;
  episodes: string;
};

type RatingRow = {
  media_item_id: string;
  host: string;
  rating: string;
};

export type MoviesPageData = {
  items: MediaEntry[];
  canManage: boolean;
  viewerHost: MediaHost | null;
};

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function flag(value: ItemRow["best_guess"]): boolean {
  if (typeof value === "boolean") return value;
  return num(value) === 1;
}

function parseEpisodes(raw: string): MediaEpisode[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as MediaEpisode;
      if (typeof row.slug !== "string" || typeof row.title !== "string") return [];
      return [{ slug: row.slug, title: row.title, timestamp: row.timestamp }];
    });
  } catch {
    return [];
  }
}

function toEntry(row: ItemRow, ratings: MediaRatings): MediaEntry | null {
  if (row.kind !== "movie" && row.kind !== "tv") return null;
  const imageKind =
    row.image_kind === "poster" || row.image_kind === "logo" || row.image_kind === "still"
      ? row.image_kind
      : null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    year: row.year ?? "",
    episodes: parseEpisodes(row.episodes),
    wikipedia_url: row.wikipedia_url,
    image: row.image,
    image_credit: row.image_credit,
    image_kind: row.image ? imageKind : null,
    best_guess: flag(row.best_guess),
    best_guess_reason: row.best_guess_reason,
    width: num(row.width),
    height: num(row.height),
    ratings,
  };
}

async function readItems(sql: Sql): Promise<MediaEntry[]> {
  const [items, ratings] = await Promise.all([
    sql<ItemRow>`
      select id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
             width, height, best_guess, best_guess_reason, episodes
      from media_item
    `,
    sql<RatingRow>`select media_item_id, host, rating from media_rating`,
  ]);
  const byId = new Map<string, MediaRatings>();
  for (const row of ratings) {
    if (row.host !== "john" && row.host !== "dan") continue;
    if (!isRating(row.rating)) continue;
    const current = byId.get(row.media_item_id) ?? { john: "not_seen", dan: "not_seen" };
    current[row.host] = row.rating;
    byId.set(row.media_item_id, current);
  }
  const entries: MediaEntry[] = [];
  for (const row of items) {
    const entry = toEntry(row, byId.get(row.id) ?? { john: "not_seen", dan: "not_seen" });
    if (entry) entries.push(entry);
  }
  return entries;
}

async function caller(sql: Sql, userId: string): Promise<{ role: string | null; email: string | null }> {
  const rows = await sql<{ role: string | null; email: string | null }>`
    select m.role as role, u.email as email
    from "user" u
    left join member_profile m on m.user_id = u.id
    where u.id = ${userId}
  `;
  return { role: rows[0]?.role ?? null, email: rows[0]?.email ?? null };
}

export async function loadMoviesPage(): Promise<MoviesPageData> {
  const sql = await getSql();
  const session = await getSessionUser();
  const items = await readItems(sql);
  if (!session) return { items, canManage: false, viewerHost: null };
  const who = await caller(sql, session.id);
  const canManage = mediaAdminDecision({ signedIn: true, role: who.role }).ok;
  return {
    items,
    canManage,
    viewerHost: canManage ? hostForEmail(session.email ?? who.email) : null,
  };
}

async function assertAdmin(sql: Sql, userId: string): Promise<{ email: string | null }> {
  const who = await caller(sql, userId);
  const decision = mediaAdminDecision({ signedIn: true, role: who.role });
  if (!decision.ok) throw new Error(decision.error);
  return { email: who.email };
}

function nextId(title: string, taken: Set<string>): string {
  const base = title
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "title";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
  return `${base}-${Date.now()}`;
}

export async function saveMediaItem(
  userId: string,
  input: { id?: string; draft: unknown },
): Promise<MediaEntry> {
  const draft = parseMediaDraft(input.draft);
  if ("error" in draft) throw new Error(draft.error);
  const sql = await getSql();
  await assertAdmin(sql, userId);
  const now = Date.now();
  const existingId = typeof input.id === "string" && input.id ? input.id : null;
  if (existingId) {
    const current = await sql<{ id: string; width: number | null; height: number | null }>`
      select id, width, height from media_item where id = ${existingId}
    `;
    if (!current[0]) throw new Error("That title isn't on the page.");
    await sql`
      update media_item set
        kind = ${draft.kind},
        title = ${draft.title},
        year = ${draft.year},
        wikipedia_url = ${draft.wikipediaUrl},
        image = ${draft.image},
        image_credit = ${draft.imageCredit},
        image_kind = ${draft.imageKind},
        best_guess = ${draft.bestGuess ? 1 : 0},
        best_guess_reason = ${draft.bestGuessReason},
        episodes = ${JSON.stringify(draft.episodes)},
        sort_rank = ${newestMentionRank(draft)},
        updated_at = ${now}
      where id = ${existingId}
    `;
    const saved = (await readItems(sql)).find((item) => item.id === existingId);
    if (!saved) throw new Error("That title isn't on the page.");
    return saved;
  }
  const ids = await sql<{ id: string }>`select id from media_item`;
  const id = nextId(draft.title, new Set(ids.map((row) => row.id)));
  await sql`
    insert into media_item (
      id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
      best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
    ) values (
      ${id}, ${draft.kind}, ${draft.title}, ${draft.year}, ${draft.wikipediaUrl},
      ${draft.image}, ${draft.imageCredit}, ${draft.imageKind},
      ${draft.bestGuess ? 1 : 0}, ${draft.bestGuessReason},
      ${JSON.stringify(draft.episodes)}, ${newestMentionRank(draft)}, ${now}, ${now}
    )
  `;
  const saved = (await readItems(sql)).find((item) => item.id === id);
  if (!saved) throw new Error("That title isn't on the page.");
  return saved;
}

export async function deleteMediaItem(userId: string, id: string): Promise<void> {
  const sql = await getSql();
  await assertAdmin(sql, userId);
  const rows = await sql<{ id: string }>`select id from media_item where id = ${id}`;
  if (!rows[0]) throw new Error("That title isn't on the page.");
  await sql.batch([
    { text: "delete from media_rating where media_item_id = $1", params: [id] },
    { text: "delete from media_item where id = $1", params: [id] },
  ]);
}

export async function setMediaRating(userId: string, input: { id: string; rating: MediaRating }): Promise<void> {
  const sql = await getSql();
  const session = await getSessionUser();
  const who = await caller(sql, userId);
  const email = session?.email ?? who.email;
  const host = hostForEmail(email);
  if (!host) {
    const admin = mediaAdminDecision({ signedIn: true, role: who.role });
    throw new Error(admin.ok ? "You can only set your own rating." : admin.error);
  }
  const decision = mediaRatingDecision({
    signedIn: true,
    role: who.role,
    email,
    host,
  });
  if (!decision.ok) throw new Error(decision.error);
  const rows = await sql<{ id: string }>`select id from media_item where id = ${input.id}`;
  if (!rows[0]) throw new Error("That title isn't on the page.");
  const now = Date.now();
  if (input.rating === "not_seen") {
    await sql`delete from media_rating where media_item_id = ${input.id} and host = ${host}`;
    return;
  }
  await sql`
    insert into media_rating (media_item_id, host, rating, updated_at)
    values (${input.id}, ${host}, ${input.rating}, ${now})
    on conflict (media_item_id, host) do update
    set rating = ${input.rating}, updated_at = ${now}
  `;
}

function json(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function handleMediaClientUpload(request: Request): Promise<Response> {
  if (!blobUploadsEnabled()) return json(404, "Uploads are off.");
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json(400, "That file type isn't allowed.");
  }
  if (!body || (body.type !== "blob.generate-client-token" && body.type !== "blob.upload-completed")) {
    return json(400, "That file type isn't allowed.");
  }

  let userId: string | null = null;
  if (body.type === "blob.generate-client-token") {
    try {
      assertSameSiteRequest();
      userId = await requireUserId();
      const role = (await caller(await getSql(), userId)).role;
      const allowed = mediaAdminDecision({ signedIn: true, role });
      if (!allowed.ok) return json(allowed.status, allowed.error);
    } catch (err) {
      if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
      if (err instanceof CrossSiteRequestError) return json(403, err.message);
      const message = err instanceof Error ? err.message : "Unauthorized";
      return json(message === "Unauthorized" ? 401 : 403, message);
    }
  }

  try {
    const result = await handleUpload({
      token: blobCredentials().token,
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!userId) throw new Error("Unauthorized");
        if (!MEDIA_BLOB_PATH.test(pathname)) throw new Error("That file type isn't allowed.");
        const declared = readDeclared(clientPayload);
        if (!declared) throw new Error("That file type isn't allowed.");
        const classified = classifyUpload(declared.name, declared.type, declared.size);
        if (!classified.ok || classified.kind !== "image") {
          throw new Error(classified.ok ? "That file type isn't allowed." : classified.error);
        }
        return {
          allowedContentTypes: [classified.contentType],
          maximumSizeInBytes: Math.min(classified.maxBytes, IMAGE_MAX_BYTES),
          addRandomSuffix: false,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
    const message = err instanceof Error && err.message ? err.message : "Couldn't upload that picture.";
    console.error("media upload", message);
    return json(400, message);
  }
}

function readDeclared(raw: string | null): { name: string; type: string; size: number } | null {
  if (!raw || raw.length > 1_000) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; type?: unknown; size?: unknown };
    if (typeof parsed.name !== "string" || typeof parsed.type !== "string") return null;
    if (typeof parsed.size !== "number" || !Number.isFinite(parsed.size)) return null;
    return { name: parsed.name, type: parsed.type, size: parsed.size };
  } catch {
    return null;
  }
}
