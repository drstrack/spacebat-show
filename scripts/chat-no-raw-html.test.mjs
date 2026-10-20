import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOTS = ["src/components/chat", "src/lib/chat"];

function walk(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

test("chat code never uses dangerouslySetInnerHTML", () => {
  const hits = [];
  for (const root of ROOTS) {
    for (const path of walk(root)) {
      if (!/\.(tsx?|jsx?|mjs)$/.test(path)) continue;
      const text = readFileSync(path, "utf8");
      if (text.includes("dangerouslySetInnerHTML")) hits.push(path);
    }
  }
  assert.deepEqual(hits, []);
});

test("chat migration avoids words toSqlite rewrites", () => {
  const sql = readFileSync("migrations/0004_chat.sql", "utf8");
  assert.equal(/\bdate\b/i.test(sql), false);
  assert.equal(/\bboolean\b/i.test(sql), false);
  assert.equal(/\btimestamptz\b/i.test(sql), false);
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
  assert.equal(statements.length, 4);
  assert.match(sql, /create table if not exists chat_member/);
  assert.match(sql, /create table if not exists chat_message/);
  assert.match(sql, /if not exists chat_message_room_id_idx/);
  assert.match(sql, /if not exists chat_message_user_idx/);
});
