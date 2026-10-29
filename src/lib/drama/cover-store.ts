import type { Work } from "./types";

/**
 * 封面圖片儲存。
 *
 * localStorage 只存作品資料與「封面參照字串」，圖片本體不放進去：
 * - 線上封面、示範封面：直接存圖片網址（https:// 或站內 /assets 路徑）
 * - 使用者上傳的封面：壓縮後以二進位存進 IndexedDB，作品裡只存 `nina-cover:<key>`
 * - 舊資料裡的 data:image/... Base64 封面：啟動時自動搬進 IndexedDB（搬不動就原樣保留，不會遺失）
 */

export const COVER_REF_PREFIX = "nina-cover:";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CoverRecord {
  data: ArrayBuffer;
  type: string;
  createdAt: number;
}

export interface CoverBlobStore {
  put(key: string, rec: CoverRecord): Promise<void>;
  get(key: string): Promise<CoverRecord | undefined>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export const isCoverRef = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith(COVER_REF_PREFIX) && v.length > COVER_REF_PREFIX.length;

export const isInlineCover = (v: unknown): v is string =>
  typeof v === "string" && /^data:image\//i.test(v);

const refKey = (ref: string) => ref.slice(COVER_REF_PREFIX.length);

/** 只允許可安全放進 <img src> 的封面值 */
export function isSafeCover(v: unknown): v is string {
  if (typeof v !== "string" || !v) return false;
  if (v.indexOf(COVER_REF_PREFIX) === 0 || /^data:image\//i.test(v)) return true;
  if (/^\/(?!\/)/.test(v)) return true;
  return /^https:\/\//i.test(v);
}

export function dataUrlToRecord(dataUrl: string, now = Date.now()): CoverRecord {
  const m = /^data:(image\/[a-z0-9.+-]+)?((?:;[^,;]*)*?)(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!m) throw new Error("封面格式不正確");
  const type = (m[1] ?? "image/jpeg").toLowerCase();
  const body = m[4] ?? "";
  let bytes: Uint8Array;
  if (m[3]) {
    const bin = atob(body.replace(/\s/g, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(body));
  }
  if (bytes.byteLength === 0) throw new Error("封面是空的");
  return {
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    type,
    createdAt: now,
  };
}

export function recordToDataUrl(rec: CoverRecord): string {
  const bytes = new Uint8Array(rec.data);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${rec.type};base64,${btoa(bin)}`;
}

function newKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------- IndexedDB 實作 ---------------- */

const DB_NAME = "nina-drama-covers";
const STORE = "covers";

export class IdbCoverStore implements CoverBlobStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
          const db = req.result;
          // 其他分頁升級資料庫時釋放連線，下次重新開啟
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error("無法開啟封面資料庫"));
        req.onblocked = () => reject(new Error("封面資料庫被其他分頁占用"));
      }).catch((e) => {
        this.dbPromise = null;
        throw e;
      });
    }
    return this.dbPromise;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error("封面資料庫錯誤"));
      tx.onabort = () => reject(tx.error ?? new Error("封面寫入被中止（空間可能不足）"));
    });
  }

  async put(key: string, rec: CoverRecord) {
    await this.run("readwrite", (s) => s.put(rec, key));
  }
  get(key: string) {
    return this.run<CoverRecord | undefined>(
      "readonly",
      (s) => s.get(key) as IDBRequest<CoverRecord | undefined>,
    );
  }
  async delete(key: string) {
    await this.run("readwrite", (s) => s.delete(key));
  }
  async keys() {
    const keys = await this.run("readonly", (s) => s.getAllKeys());
    return keys.map(String);
  }
}

export class MemoryCoverStore implements CoverBlobStore {
  map = new Map<string, CoverRecord>();
  async put(key: string, rec: CoverRecord) {
    this.map.set(key, rec);
  }
  async get(key: string) {
    return this.map.get(key);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async keys() {
    return [...this.map.keys()];
  }
}

let defaultStore: CoverBlobStore | null | undefined;

export function getCoverStore(): CoverBlobStore | null {
  if (defaultStore === undefined) {
    defaultStore = typeof indexedDB !== "undefined" ? new IdbCoverStore() : null;
  }
  return defaultStore;
}

let persistRequested = false;
function requestPersistentStorage() {
  if (persistRequested || typeof navigator === "undefined") return;
  persistRequested = true;
  void navigator.storage?.persist?.().catch(() => {});
}

/* ---------------- 讀寫 ---------------- */

export async function saveCoverRecord(
  rec: Omit<CoverRecord, "createdAt">,
  store = getCoverStore(),
): Promise<string> {
  if (!store) throw new Error("此瀏覽器不支援封面儲存");
  const key = newKey();
  await store.put(key, { ...rec, createdAt: Date.now() });
  requestPersistentStorage();
  return COVER_REF_PREFIX + key;
}

export async function saveCoverBlob(blob: Blob, store = getCoverStore()): Promise<string> {
  return saveCoverRecord(
    { data: await blob.arrayBuffer(), type: blob.type || "image/jpeg" },
    store,
  );
}

const urlCache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

/** 已解析過的封面網址（同步）；undefined = 尚未解析 */
export function peekCoverUrl(ref: string): string | null | undefined {
  return urlCache.get(ref);
}

/** 把 `nina-cover:` 參照轉成可顯示的 blob: 網址；找不到圖片時回傳 null。 */
export function loadCoverUrl(ref: string, store = getCoverStore()): Promise<string | null> {
  if (urlCache.has(ref)) return Promise.resolve(urlCache.get(ref) ?? null);
  let p = pending.get(ref);
  if (!p) {
    p = (async () => {
      if (!store) return null;
      try {
        const rec = await store.get(refKey(ref));
        if (!rec) return null;
        return URL.createObjectURL(new Blob([rec.data], { type: rec.type }));
      } catch (e) {
        console.error("cover load failed", e);
        return null;
      }
    })().then((url) => {
      urlCache.set(ref, url);
      pending.delete(ref);
      return url;
    });
    pending.set(ref, p);
  }
  return p;
}

/* ---------------- 遷移、清理、備份 ---------------- */

export interface CoverChange {
  workId: string;
  from: string;
  to: string;
}

/** 把作品中的 Base64 封面搬進 IndexedDB；單筆失敗就保留原值。 */
export async function migrateInlineCovers(
  works: Work[],
  store: CoverBlobStore,
): Promise<CoverChange[]> {
  const changes: CoverChange[] = [];
  const done = new Map<string, string>();
  for (const w of works) {
    if (!isInlineCover(w.cover)) continue;
    let to = done.get(w.cover);
    if (!to) {
      try {
        const rec = dataUrlToRecord(w.cover);
        const key = newKey();
        await store.put(key, rec);
        to = COVER_REF_PREFIX + key;
        done.set(w.cover, to);
      } catch (e) {
        console.error("cover migration failed", w.id, e);
        continue;
      }
    }
    changes.push({ workId: w.id, from: w.cover, to });
  }
  return changes;
}

/** 刪除沒有任何作品使用、且建立超過 minAgeMs 的封面（避免誤刪還在表單中的新封面）。 */
export async function gcCovers(
  works: Work[],
  store: CoverBlobStore,
  now = Date.now(),
  minAgeMs = DAY_MS,
) {
  const used = new Set(
    works.filter((w) => isCoverRef(w.cover)).map((w) => refKey(w.cover as string)),
  );
  let removed = 0;
  for (const key of await store.keys()) {
    if (used.has(key)) continue;
    const rec = await store.get(key);
    if (rec && now - rec.createdAt < minAgeMs) continue;
    await store.delete(key);
    removed++;
  }
  return removed;
}

/** 匯出備份用：把 IndexedDB 封面還原成 Base64，讓備份檔可在其他裝置使用。 */
export async function inlineCoversForBackup(
  works: Work[],
  store = getCoverStore(),
): Promise<Work[]> {
  return Promise.all(
    works.map(async (w) => {
      const inline = async (cover: string | null | undefined) => {
        if (!isCoverRef(cover)) return cover;
        const rec = store ? await store.get(refKey(cover)).catch(() => undefined) : undefined;
        return rec ? recordToDataUrl(rec) : null;
      };
      return {
        ...w,
        cover: await inline(w.cover),
        seasons: await Promise.all(
          w.seasons.map(async (season) => ({ ...season, cover: await inline(season.cover) })),
        ),
      };
    }),
  );
}

/** 匯入備份用：Base64 封面改存 IndexedDB；不安全的封面值移除。 */
export async function externalizeCovers(works: Work[], store = getCoverStore()): Promise<Work[]> {
  const out: Work[] = [];
  for (const w of works) {
    const externalize = async (cover: string | null | undefined) => {
      if (cover == null) return cover;
      if (!isSafeCover(cover)) return null;
      if (!isInlineCover(cover) || !store) return cover;
      try {
        return await saveCoverRecord(dataUrlToRecord(cover), store);
      } catch (e) {
        console.error("cover import failed", w.id, e);
        return cover;
      }
    };
    out.push({
      ...w,
      cover: await externalize(w.cover),
      seasons: await Promise.all(
        w.seasons.map(async (season) => ({ ...season, cover: await externalize(season.cover) })),
      ),
    });
  }
  return out;
}

/** 啟動時執行：搬移舊 Base64 封面，再清理沒用到的封面。 */
export async function runCoverMaintenance(
  getWorks: () => Work[],
  apply: (changes: CoverChange[]) => boolean,
  store = getCoverStore(),
) {
  if (!store) return;
  const changes = await migrateInlineCovers(getWorks(), store);
  if (changes.length > 0 && !apply(changes)) return;
  const works = getWorks();
  // 資料讀取異常（空清單）時不清理，避免誤刪
  if (works.length > 0) await gcCovers(works, store);
}
