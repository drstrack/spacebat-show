import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import type { ScheduleException } from "@/lib/schedule-exceptions";
import type { ScheduleOverrideInput } from "@/lib/schedule-overrides";
import {
  deleteScheduleOverride,
  listScheduleExceptions,
  loadSchedulePage,
  saveScheduleOverride,
} from "@/lib/schedule-overrides.server";

export const loadPublicSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScheduleException[]> => {
    try {
      return await listScheduleExceptions();
    } catch {
      return [];
    }
  },
);

export const loadScheduleAdmin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await getSessionUser();
    return await loadSchedulePage(session?.id ?? null);
  } catch {
    return { canManage: false as const, overrides: [] as ScheduleException[] };
  }
});

function overrideInput(input: unknown): ScheduleOverrideInput {
  if (!input || typeof input !== "object") throw new Error("That schedule change isn't valid.");
  const raw = input as Record<string, unknown>;
  const skipDate = typeof raw.skipDate === "string" ? raw.skipDate : "";
  const showDate = typeof raw.showDate === "string" ? raw.showDate : "";
  const note = typeof raw.note === "string" ? raw.note : "";
  const hour = typeof raw.hour === "number" ? raw.hour : Number(raw.hour);
  const minute = typeof raw.minute === "number" ? raw.minute : Number(raw.minute);
  return {
    skipDate,
    cancelled: raw.cancelled === true,
    showDate,
    hour: Number.isFinite(hour) ? hour : 20,
    minute: Number.isFinite(minute) ? minute : 30,
    note,
  };
}

export const saveScheduleAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(overrideInput)
  .handler(async ({ data, context }) => saveScheduleOverride(context.userId, data));

export const deleteScheduleAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { skipDate?: string }) => {
    if (!input || typeof input.skipDate !== "string") throw new Error("Use a real calendar date.");
    return { skipDate: input.skipDate };
  })
  .handler(async ({ data, context }) => deleteScheduleOverride(context.userId, data.skipDate));
