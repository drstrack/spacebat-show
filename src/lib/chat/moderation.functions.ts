import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  MUTE_1H_MINUTES,
  MUTE_24H_MINUTES,
  REPORT_REASONS,
  RESOLVE_ACTIONS,
  type ReportReason,
  type ResolveAction,
} from "@/lib/chat/moderation";
import {
  adminAddBlockword as addBlockword,
  adminBan as banMember,
  adminDeleteMessage as removeAnyMessage,
  adminMute as muteMember,
  adminRemoveBlockword as removeBlockword,
  adminUnban as unbanMember,
  adminUnmute as unmuteMember,
  listAudit as readAudit,
  listBlockwords as readBlockwords,
  listReports as readReports,
  listSanctions as readSanctions,
  reportMessage as saveReport,
  resolveReport as saveResolution,
  type AuditEntry,
  type BlockwordEntry,
  type ReportGroup,
  type SanctionedMember,
} from "@/lib/chat/moderation.server";
import {
  adminDeleteChatUpload as removeUpload,
  listChatUploads as readUploads,
  type ListedUpload,
} from "@/lib/chat/uploads.server";

export type { AuditEntry, BlockwordEntry, ListedUpload, ReportGroup, SanctionedMember };

function cleanId(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(message);
  return value;
}

export const adminDeleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; reason?: string }) => {
    const id = cleanId(input?.id, "That message is gone.");
    const reason = input.reason?.trim() ?? "";
    if (reason.length > 200) throw new Error("Keep the note under 200 characters.");
    return { id, reason: reason || undefined };
  })
  .handler(async ({ data, context }) => removeAnyMessage(context.userId, data));

export const adminMute = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; minutes: number }): { userId: string; minutes: 60 | 1440 } => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("Missing listener.");
    if (input.minutes !== MUTE_1H_MINUTES && input.minutes !== MUTE_24H_MINUTES) {
      throw new Error("Mute for 1 hour or 24 hours.");
    }
    return {
      userId: input.userId,
      minutes: input.minutes === MUTE_24H_MINUTES ? MUTE_24H_MINUTES : MUTE_1H_MINUTES,
    };
  })
  .handler(async ({ data, context }) => muteMember(context.userId, data));

export const adminUnmute = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("Missing listener.");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => unmuteMember(context.userId, data));

export const adminBan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; reason: string; purge?: boolean }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("Missing listener.");
    if (typeof input.reason !== "string") throw new Error("Say why.");
    if (input.purge != null && typeof input.purge !== "boolean") throw new Error("Say why.");
    return { userId: input.userId, reason: input.reason, purge: input.purge === true };
  })
  .handler(async ({ data, context }) => banMember(context.userId, data));

export const adminUnban = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("Missing listener.");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => unbanMember(context.userId, data));

export const reportMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messageId: number; reason: string; note?: string }) => {
    const messageId = cleanId(input?.messageId, "That message is gone.");
    if (!REPORT_REASONS.includes(input.reason as ReportReason)) throw new Error("Pick a reason.");
    return { messageId, reason: input.reason, note: input.note ?? "" };
  })
  .handler(async ({ data, context }) => saveReport(context.userId, data));

export const listReports = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ReportGroup[]> => readReports(context.userId));

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messageId: number; action: string }) => {
    const messageId = cleanId(input?.messageId, "That message is gone.");
    if (!RESOLVE_ACTIONS.includes(input.action as ResolveAction)) throw new Error("Pick an action.");
    return { messageId, action: input.action as ResolveAction };
  })
  .handler(async ({ data, context }) => saveResolution(context.userId, data));

export const listAudit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { before?: number } | undefined) => {
    if (input?.before == null) return {};
    return { before: cleanId(input.before, "Couldn’t load the log.") };
  })
  .handler(async ({ data, context }): Promise<AuditEntry[]> => readAudit(context.userId, data));

export const listSanctions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SanctionedMember[]> => readSanctions(context.userId));

export const listBlockwords = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BlockwordEntry[]> => readBlockwords(context.userId));

export const adminAddBlockword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { word: string }) => {
    if (!input || typeof input.word !== "string") throw new Error("Use a single word, 2–32 letters or numbers.");
    return { word: input.word };
  })
  .handler(async ({ data, context }) => addBlockword(context.userId, data));

export const listChatUploads = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ListedUpload[]> => readUploads(context.userId));

export const adminDeleteChatUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => ({ id: cleanId(input?.id, "That upload is already gone.") }))
  .handler(async ({ data, context }) => removeUpload(context.userId, data.id));

export const adminRemoveBlockword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { word: string }) => {
    if (!input || typeof input.word !== "string") throw new Error("Use a single word, 2–32 letters or numbers.");
    return { word: input.word };
  })
  .handler(async ({ data, context }) => removeBlockword(context.userId, data));
