import type { Work, CustomCategory } from "./types";
import { migrateWork } from "./domain";

/**
 * 資料存取層介面。第一版以 localStorage 實作；
 * 未來改用正式資料庫時，只需提供同介面的新實作。
 */
export interface DramaRepository {
  /** 回傳 null 代表從未初始化（首次開啟） */
  load(): Work[] | null;
  save(works: Work[], categories?: CustomCategory[]): void;
  loadCategories?(): CustomCategory[];
}

const STORAGE_KEY = "nina-drama:v1";
const MIGRATION_BACKUP_KEY = "nina-drama:migration-backup:v1-to-v2";
const MIGRATION_REPORT_KEY = "nina-drama:migration-report:v2";

interface Stored {
  version: 1 | 2;
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
      if (!Array.isArray(parsed.works)) return [];
      if (parsed.version === 2) return parsed.works;

      // Safari 原地遷移：先留完整原文備份，驗證筆數與 ID 後才替換主資料。
      const migrated = parsed.works.map(migrateWork);
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
      const next: Stored = { ...parsed, version: 2, works: migrated };
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
    } catch {
      // 任何失敗都不改寫主資料；若主資料已被寫入才出錯，立刻回復原文。
      const backup = window.localStorage.getItem(MIGRATION_BACKUP_KEY);
      if (backup && window.localStorage.getItem(this.key) !== raw) {
        window.localStorage.setItem(this.key, backup);
      }
      return [];
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
    const data: Stored = { ...previous, version: 2, works, customCategories: categories };
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
}

export class MemoryRepository implements DramaRepository {
  private works: Work[] | null;
  private categories: CustomCategory[] = [];
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
}
