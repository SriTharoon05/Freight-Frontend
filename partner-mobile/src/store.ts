import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import type { Json, QueueItem, Task } from "./types";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
export async function db() {
  if (!database)
    database = (async () => {
      let key = await SecureStore.getItemAsync("partner_db_key");
      if (!key) {
        key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        await SecureStore.setItemAsync("partner_db_key", key, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
      }
      if (!/^[a-f0-9]{64}$/.test(key))
        throw new Error("Invalid encrypted device store key");
      const connection = await SQLite.openDatabaseAsync("partners.db");
      const cipher = await connection.getFirstAsync<Record<string, string>>(
        "PRAGMA cipher_version",
      );
      if (!cipher || !Object.values(cipher).some(Boolean)) {
        await connection.closeAsync();
        throw new Error(
          "This app build requires encrypted SQLCipher storage. Use the configured development build.",
        );
      }
      await connection.execAsync(
        `PRAGMA key = "x'${key}'"; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS cache (id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS queue (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, resource_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, error TEXT);`,
      );
      return connection;
    })();
  return database;
}
export async function cache<T>(key: string): Promise<T | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ value: string }>("SELECT value FROM cache WHERE id=?", key);
  return row ? JSON.parse(row.value) : null;
}
export async function remember(key: string, value: unknown) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO cache(id,value) VALUES(?,?)",
    key,
    JSON.stringify(value),
  );
}
export async function enqueue(
  resource: string,
  kind: QueueItem["kind"],
  payload: Json,
  id = Crypto.randomUUID(),
) {
  await (
    await db()
  ).runAsync(
    "INSERT OR IGNORE INTO queue(id,resource_id,kind,payload) VALUES(?,?,?,?)",
    id,
    resource,
    kind,
    JSON.stringify(payload),
  );
  return id;
}
export async function pending(): Promise<QueueItem[]> {
  const retention = (await cache<number>("gps_retention_days")) || 30;
  await (
    await db()
  ).runAsync(
    "DELETE FROM queue WHERE kind='gps' AND json_extract(payload,'$.sample.captured_at') < ?",
    new Date(Date.now() - retention * 86400000).toISOString(),
  );
  return (
    await (await db()).getAllAsync<any>("SELECT * FROM queue ORDER BY sequence")
  ).map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}
export async function remove(id: string) {
  await (await db()).runAsync("DELETE FROM queue WHERE id=?", id);
}
export async function discardResource(id: string) {
  await (await db()).runAsync("DELETE FROM queue WHERE resource_id=?", id);
}
export async function fail(id: string, error: string) {
  await (await db()).runAsync("UPDATE queue SET error=? WHERE id=?", error, id);
}
export async function saveProof(
  resource: string,
  uri: string,
  kind: string,
  contentType: string,
  reservation = false,
) {
  const file = new File(uri),
    size = file.size;
  if (!size || size > 10 * 1024 * 1024)
    throw new Error("Choose an image or PDF under 10 MB.");
  const id = Crypto.randomUUID(),
    captured_at = new Date().toISOString();
  // Store the media inside SQLCipher, then remove the app-owned temporary copy.
  const bytes = await file.base64();
  await enqueue(
    resource,
    "upload",
    {
      reservation,
      bytes,
      metadata: {
        id,
        kind,
        filename: `${id}.${contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg"}`,
        content_type: contentType,
        size_bytes: size,
        captured_at,
      },
    },
    id,
  );
  if (uri.startsWith("file://")) {
    try {
      file.delete();
    } catch {
      /* OS may own a picker cache entry. */
    }
  }
  return { id, kind, captured_at, status: "pending_sync" };
}
export async function localTask(id: string) {
  return cache<Task>("task:" + id);
}
export async function wipe() {
  const connection = await db();
  await connection.execAsync(
    "DELETE FROM cache; DELETE FROM queue; PRAGMA wal_checkpoint(TRUNCATE);",
  );
  await connection.closeAsync();
  database = undefined;
  await SQLite.deleteDatabaseAsync("partners.db");
  await SecureStore.deleteItemAsync("partner_db_key");
}
