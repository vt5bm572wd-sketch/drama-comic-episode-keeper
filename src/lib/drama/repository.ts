import type { Work, CustomCategory, MergeSnapshot } from "./types";
import { normalizeDramaWorks } from "./data-normalization";

/**
 * 資料存取層介面。第一版以 localStorage 實作；
 * 未來改用正式資料庫時，只需提供同介面的新實作。
 */
export interface DramaRepository {
  /** 回傳 null 代表從未初始化（首次開啟） */
  load(): Work[] | null;
  save(works: Work[], categories?: CustomCategory[]): void;
  loadCategories?(): CustomCategory[];
  saveSnapshot?(snapshot: MergeSnapshot): void;
  loadSnapshot?(): MergeSnapshot | null;
  clearSnapshot?(): void;
}

const STORAGE_KEY = "nina-drama:v1";
const MIGRATION_BACKUP_KEY = "nina-drama:migration-backup:v2-to-v3";
const MIGRATION_REPORT_KEY = "nina-drama:migration-report:v3";
const MERGE_SNAPSHOT_KEY = "nina-drama:merge-snapshot:v2";

export class CorruptDramaDataError extends Error {
  constructor(message = "收藏資料損壞，已停止所有寫入。請先從備份還原。") {
    super(message);
    this.name = "CorruptDramaDataError";
  }
}

interface Stored {
  version: 1 | 2 | 3;
  works: Work[];
  customCategories?: CustomCategory[];
}

export class LocalStorageRepository implements DramaRepository {
  constructor(private key = STORAGE_KEY) {}

  load(): Work[] | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(this.key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as Stored;
      if (!parsed || !Array.isArray(parsed.works)) throw new CorruptDramaDataError();
      if (parsed.version === 3) return parsed.works;

      // Safari 原地遷移：先留完整原文備份，驗證筆數與 ID 後才替換主資料。
      const migrated = normalizeDramaWorks(parsed.works);
      const beforeIds = parsed.works.map((w) => w.id).sort();
      const afterIds = migrated.map((w) => w.id).sort();
      if (
        migrated.length !== parsed.works.length ||
        beforeIds.some((id, i) => id !== afterIds[i])
      ) {
        throw new Error("資料遷移驗證失敗");
      }
      if (!window.localStorage.getItem(MIGRATION_BACKUP_KEY)) {
        window.localStorage.setItem(MIGRATION_BACKUP_KEY, raw);
      }
      const next: Stored = { ...parsed, version: 3, works: migrated };
      window.localStorage.setItem(this.key, JSON.stringify(next));
      window.localStorage.setItem(
        MIGRATION_REPORT_KEY,
        JSON.stringify({
          migratedAt: new Date().toISOString(),
          before: parsed.works.length,
          after: migrated.length,
          ok: true,
        }),
      );
      return migrated;
    } catch (error) {
      // 任何失敗都不改寫主資料；若主資料已被寫入才出錯，立刻回復原文。
      const backup = window.localStorage.getItem(MIGRATION_BACKUP_KEY);
      if (backup && window.localStorage.getItem(this.key) !== raw) {
        window.localStorage.setItem(this.key, backup);
      }
      throw error instanceof CorruptDramaDataError
        ? error
        : new CorruptDramaDataError("收藏 JSON 無法解析，已停止所有寫入。請匯入有效備份後再繼續。");
    }
  }

  loadCategories(): CustomCategory[] {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(this.key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.customCategories) ? parsed.customCategories : [];
  }

  save(works: Work[], categories: CustomCategory[] = this.loadCategories()): void {
    const raw = window.localStorage.getItem(this.key);
    // Never overwrite an unreadable store, including during startup maintenance.
    const previous = raw ? JSON.parse(raw) : {};
    if (raw && !Array.isArray(previous.works)) throw new Error("無法讀取現有資料，已停止寫入");
    const data: Stored = { ...previous, version: 3, works, customCategories: categories };
    window.localStorage.setItem(this.key, JSON.stringify(data));
  }

  get storageKey(): string {
    return this.key;
  }

  getMigrationReport(): { migratedAt: string; before: number; after: number; ok: boolean } | null {
    if (typeof window === "undefined") return null;
    try {
      const value = JSON.parse(window.localStorage.getItem(MIGRATION_REPORT_KEY) ?? "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  rollbackMigration(): boolean {
    if (typeof window === "undefined") return false;
    const backup = window.localStorage.getItem(MIGRATION_BACKUP_KEY);
    if (!backup) return false;
    JSON.parse(backup);
    window.localStorage.setItem(this.key, backup);
    window.localStorage.removeItem(MIGRATION_REPORT_KEY);
    return true;
  }

  saveSnapshot(snapshot: MergeSnapshot): void {
    window.localStorage.setItem(MERGE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }

  loadSnapshot(): MergeSnapshot | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(MERGE_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as MergeSnapshot;
      return value && Array.isArray(value.works) ? value : null;
    } catch {
      return null;
    }
  }

  clearSnapshot(): void {
    window.localStorage.removeItem(MERGE_SNAPSHOT_KEY);
  }
}

export class MemoryRepository implements DramaRepository {
  private works: Work[] | null;
  private categories: CustomCategory[] = [];
  private snapshot: MergeSnapshot | null = null;
  constructor(initial: Work[] | null = null) {
    this.works = initial;
  }
  load() {
    return this.works;
  }
  loadCategories() {
    return this.categories;
  }
  save(works: Work[], categories: CustomCategory[] = this.categories) {
    this.works = works;
    this.categories = categories;
  }
  saveSnapshot(snapshot: MergeSnapshot) {
    this.snapshot = structuredClone(snapshot);
  }
  loadSnapshot() {
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }
  clearSnapshot() {
    this.snapshot = null;
  }
}