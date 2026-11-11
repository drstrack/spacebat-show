import { getSql, type Sql } from "@/lib/db";
import {
  overrideConflicts,
  parseScheduleOverride,
  scheduleExceptionFromRow,
  type ScheduleOverrideInput,
} from "@/lib/schedule-overrides";
import type { ScheduleException } from "@/lib/schedule-exceptions";

const CACHE_MS = 60_000;

let cache: { at: number; rows: ScheduleException[] } | null = null;

export function clearScheduleOverrideCache(): void {
  cache = null;
}

/** Every stored override. Damaged rows are dropped. Expired rows stay until deleted. */
export async function listScheduleExceptions(): Promise<ScheduleException[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.rows;
  const sql = await getSql();
  const rows = await sql<{ skip_date: string; show_start: unknown; note: string }>`
    select skip_date, show_start, note
    from show_schedule_override
    order by skip_date
  `;
  const parsed = rows.flatMap((row) => {
    const exception = scheduleExceptionFromRow(row);
    return exception ? [exception] : [];
  });
  cache = { at: now, rows: parsed };
  return parsed;
}

export async function loadSchedulePage(userId: string | null): Promise<{
  canManage: boolean;
  overrides: ScheduleException[];
}> {
  const sql = await getSql();
  if (!userId || !(await isAdmin(sql, userId))) return { canManage: false, overrides: [] };
  return { canManage: true, overrides: await listScheduleExceptions() };
}

export async function saveScheduleOverride(
  userId: string,
  input: ScheduleOverrideInput,
): Promise<ScheduleException[]> {
  const sql = await getSql();
  if (!(await isAdmin(sql, userId))) throw new Error("Crew only.");
  const candidate = parseScheduleOverride(input);
  const existing = await listScheduleExceptions();
  const conflict = overrideConflicts(candidate, existing);
  if (conflict) throw new Error(conflict);
  await sql`
    insert into show_schedule_override (skip_date, show_start, note)
    values (${candidate.skipDate}, ${candidate.showStart}, ${candidate.note})
    on conflict (skip_date) do update set
      show_start = excluded.show_start,
      note = excluded.note
  `;
  clearScheduleOverrideCache();
  return listScheduleExceptions();
}

export async function deleteScheduleOverride(userId: string, skipDate: string): Promise<ScheduleException[]> {
  const sql = await getSql();
  if (!(await isAdmin(sql, userId))) throw new Error("Crew only.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(skipDate)) throw new Error("Use a real calendar date.");
  await sql`delete from show_schedule_override where skip_date = ${skipDate}`;
  clearScheduleOverrideCache();
  return listScheduleExceptions();
}

async function isAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ role: string }>`
    select role from member_profile where user_id = ${userId}
  `;
  return rows[0]?.role === "admin";
}
