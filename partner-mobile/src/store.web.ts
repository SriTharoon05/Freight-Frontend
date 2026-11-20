import type { Json, QueueItem, Task } from "./types";

// Keep saved work in IndexedDB with a non-extractable AES key. This protects
// stored values, but is not an OS keychain and cannot protect against same-origin
// script access. Authentication tokens are kept separately in sessionStorage.
let database: Promise<IDBDatabase> | undefined;
let encryption: Promise<CryptoKey> | undefined;
export function db() {
  return database ||= new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.isSecureContext || !window.indexedDB || !crypto.subtle)
      return reject(new Error("Use HTTPS and allow browser storage to save pending work."));
    const request = indexedDB.open("freight-partner-web", 1);
    request.onupgradeneeded = () => {
      for (const name of ["cache", "queue", "keys"]) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Browser storage is unavailable. Allow site storage and reload."));
  });
}
async function read(store: string, key?: string): Promise<any> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(store);
    const request = key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(store: string, key: string, value?: unknown) {
  const connection = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = connection.transaction(store, "readwrite");
    if (value === undefined) tx.objectStore(store).delete(key);
    else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("Unable to save pending work. Browser storage may be full."));
  });
}
function key() {
  return encryption ||= (async () => {
    const existing = await read("keys", "encryption");
    if (existing) return existing as CryptoKey;
    const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    // Serialize key creation across browser tabs; never replace a key in use.
    const connection = await db();
    return new Promise<CryptoKey>((resolve, reject) => {
      const tx = connection.transaction("keys", "readwrite");
      const request = tx.objectStore("keys").get("encryption");
      let selected = generated;
      request.onsuccess = () => {
        if (request.result) selected = request.result;
        else tx.objectStore("keys").put(generated, "encryption");
      };
      tx.oncomplete = () => resolve(selected);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  })();
}
async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(value)));
  return { iv, encrypted };
}
async function unseal(value: any) {
  if (!value) return null;
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: value.iv }, await key(), value.encrypted);
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function cache<T>(id: string): Promise<T | null> { return unseal(await read("cache", id)); }
export async function remember(id: string, value: unknown) { await write("cache", id, await seal(value)); }
export async function enqueue(resource: string, kind: QueueItem["kind"], payload: Json, id: string = crypto.randomUUID()) {
  const encrypted = await seal({ id, resource_id: resource, kind, payload, error: null });
  const connection = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = connection.transaction(["queue", "keys"], "readwrite"), store = tx.objectStore("queue");
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) return;
      const counter = tx.objectStore("keys").get("sequence");
      counter.onsuccess = () => {
        const sequence = Number(counter.result || 0) + 1;
        tx.objectStore("keys").put(sequence, "sequence");
        store.put({ ...encrypted, sequence }, id);
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  return id;
}
export async function pending(): Promise<QueueItem[]> {
  const rows: any[] = await read("queue");
  const retention = (await cache<number>("gps_retention_days")) || 30;
  const result: QueueItem[] = [];
  for (const row of rows.sort((a, b) => a.sequence - b.sequence)) {
    const item = await unseal(row) as QueueItem;
    if (item.kind === "gps" && Date.parse(item.payload.sample.captured_at) < Date.now() - retention * 86400000)
      await remove(item.id);
    else result.push(item);
  }
  return result;
}
export async function remove(id: string) { await write("queue", id); }
export async function discardResource(id: string) {
  for (const item of await pending()) if (item.resource_id === id) await remove(item.id);
}
export async function fail(id: string, error: string) {
  const row = await read("queue", id);
  if (row) await write("queue", id, { ...await seal({ ...await unseal(row), error }), sequence: row.sequence });
}
export async function saveProof(resource: string, uri: string, kind: string, contentType: string, reservation = false) {
  if (!/^(blob:|data:)/.test(uri)) throw new Error("Choose a local image or PDF.");
  if (!["image/jpeg", "image/png", "application/pdf"].includes(contentType)) throw new Error("Choose a JPEG, PNG or PDF.");
  const file = await (await fetch(uri)).blob();
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose an image or PDF under 10 MB.");
  const bytes = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read this file."));
    reader.readAsDataURL(file);
  });
  const id = crypto.randomUUID(), captured_at = new Date().toISOString();
  await enqueue(resource, "upload", { reservation, bytes, metadata: {
    id, kind, filename: `${id}.${contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg"}`,
    content_type: contentType, size_bytes: file.size, captured_at,
  } }, id);
  if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
  return { id, kind, captured_at, status: "pending_sync" };
}
export function localTask(id: string) { return cache<Task>("task:" + id); }
export async function wipe() {
  const connection = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = connection.transaction(["cache", "queue", "keys"], "readwrite");
    for (const name of ["cache", "queue", "keys"]) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  encryption = undefined;
}
