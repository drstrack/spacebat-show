import { dbSource, getSql } from "@/lib/db";
import { previewHostShouldBeAdmin } from "@/lib/preview-host-admin";

/** Sign-up and every session load. No-op in production. */
export async function grantPreviewHostAdmin(userId: string, email: string | null | undefined): Promise<void> {
  if (!userId) return;
  if (!previewHostShouldBeAdmin({ vercelEnv: process.env.VERCEL_ENV, dbSource, email })) return;
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql`
    insert into member_profile (user_id, role)
    values (${userId}, 'admin')
    on conflict (user_id) do update set
      role = 'admin',
      updated_at = ${now}
  `;
}
